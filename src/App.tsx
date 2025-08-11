import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import LogViewer from "./components/LogViewer";
import FilterPanel from "./components/FilterPanel";

interface LogEvent {
  timestamp: string;
  category: string;
  message: string;
  raw: string;
}

interface AppSettings {
  lastFilePath?: string;
  autoLoadLastFile: boolean;
  autoStartWatching: boolean;
}

interface UpdateInfo {
  available: boolean;
  version?: string;
  downloadUrl?: string;
}

function App() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [settings, setSettings] = useState<AppSettings>({
    autoLoadLastFile: true,
    autoStartWatching: true,
  });
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    available: false,
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const processedLogIds = useRef(new Set<string>());

  useEffect(() => {
    const getCurrentVersion = async () => {
      try {
        const version = await getVersion();
        setCurrentVersion(version);
        checkForUpdates(version);
      } catch (err) {
        console.error("Failed to get app version:", err);
      }
    };
    getCurrentVersion();
  }, []);

  const checkForUpdates = async (currentVer?: string) => {
    setIsCheckingUpdate(true);
    try {
      const version = currentVer || currentVersion;
      const response = await fetch(
        "https://api.github.com/repos/juddisjudd/poe2-log-viewer/releases/latest"
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, "");

      if (isNewerVersion(latestVersion, version)) {
        setUpdateInfo({
          available: true,
          version: latestVersion,
          downloadUrl: release.html_url,
        });
      } else {
        setUpdateInfo({ available: false });
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateInfo({ available: false });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const isNewerVersion = (latest: string, current: string): boolean => {
    const parseVersion = (v: string) =>
      v.split(".").map((n) => parseInt(n, 10));
    const latestParts = parseVersion(latest);
    const currentParts = parseVersion(current);

    for (
      let i = 0;
      i < Math.max(latestParts.length, currentParts.length);
      i++
    ) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    return false;
  };

  const handleUpdateClick = () => {
    if (updateInfo.downloadUrl) {
      invoke("open_url", { url: updateInfo.downloadUrl });
    }
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem("poe2-log-viewer-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as AppSettings;
        setSettings(parsed);

        if (parsed.autoLoadLastFile && parsed.lastFilePath) {
          setCurrentFile(parsed.lastFilePath);
          if (parsed.autoStartWatching) {
            setTimeout(() => {
              startWatching(parsed.lastFilePath!);
            }, 100);
          }
        }
      } catch (err) {
        console.error("Failed to parse saved settings:", err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("poe2-log-viewer-settings", JSON.stringify(settings));
  }, [settings]);

  const handleLogEvent = useCallback((event: { payload: LogEvent }) => {
    const logEntry = event.payload;

    const logId = `${logEntry.timestamp}-${
      logEntry.category
    }-${logEntry.message.substring(0, 50)}`;

    if (processedLogIds.current.has(logId)) {
      console.log("Duplicate log filtered in frontend:", logId);
      return;
    }

    processedLogIds.current.add(logId);

    console.log("Received log event:", logEntry);
    setLogs((prev) => [...prev, logEntry]);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<LogEvent>("log_event", handleLogEvent);
      } catch (err) {
        console.error("Failed to setup event listener:", err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleLogEvent]);

  const startWatching = async (filePath: string) => {
    try {
      setError("");
      console.log("Starting to watch file:", filePath);

      const result = await invoke<string>("start_watching", { path: filePath });
      setIsWatching(true);
      console.log("Watch result:", result);
    } catch (err) {
      console.error("Error starting watch:", err);
      setError(`Failed to start watching: ${err}`);
      setIsWatching(false);
    }
  };

  const pickFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Log Files", extensions: ["txt", "log"] }],
      });

      if (typeof selected === "string") {
        setCurrentFile(selected);
        setLogs([]);
        processedLogIds.current.clear();

        setSettings((prev) => ({
          ...prev,
          lastFilePath: selected,
        }));

        await startWatching(selected);
      }
    } catch (err) {
      console.error("Error picking file:", err);
      setError(`Failed to select file: ${err}`);
    }
  };

  const stopWatching = async () => {
    try {
      const result = await invoke<string>("stop_watching");
      setIsWatching(false);
      console.log("Stop result:", result);
    } catch (err) {
      console.error("Error stopping watch:", err);
      setError(`Failed to stop watching: ${err}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    processedLogIds.current.clear();
  };

  const reloadCurrentFile = async () => {
    if (currentFile) {
      setLogs([]);
      processedLogIds.current.clear();
      await startWatching(currentFile);
    }
  };

  const updateSetting = (key: keyof AppSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getFileName = (path: string) => {
    return path.split(/[\\/]/).pop() || path;
  };

  const getShortPath = (path: string) => {
    const parts = path.split(/[\\/]/);
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join("/")}`;
    }
    return path;
  };

  return (
    <div className="h-screen bg-black text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-950 border-b border-gray-800 p-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">
              POE2 Log Viewer
            </h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isWatching ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                }`}
              />
              <span className="text-xs text-gray-400">
                {isWatching ? "Live" : "Stopped"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={pickFile}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-gray-700"
            >
              Select File
            </button>
            {currentFile && !isWatching && (
              <button
                onClick={reloadCurrentFile}
                className="bg-blue-900 hover:bg-blue-800 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-blue-800"
              >
                Start Watching
              </button>
            )}
            {isWatching && (
              <button
                onClick={stopWatching}
                className="bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-red-800"
              >
                Stop
              </button>
            )}
            <button
              onClick={clearLogs}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-sm font-medium transition-colors border border-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        {/* File info and stats */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <div className="text-gray-400">
            {currentFile ? (
              <span>
                <span className="text-gray-500">File:</span>
                <span className="text-gray-300 ml-1" title={currentFile}>
                  {getShortPath(currentFile)}
                </span>
              </span>
            ) : (
              <span>No file selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-gray-400">
              <span className="text-gray-500">Logs:</span>
              <span className="text-white ml-1 font-medium">
                {logs.length.toLocaleString()}
              </span>
            </div>
            {/* Version and Update Info */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">v{currentVersion}</span>
              {updateInfo.available && (
                <button
                  onClick={handleUpdateClick}
                  className="bg-green-900 hover:bg-green-800 text-green-100 px-2 py-0.5 rounded text-xs font-medium transition-colors animate-pulse"
                  title={`Update available: v${updateInfo.version}`}
                >
                  Update Available
                </button>
              )}
              {isCheckingUpdate && (
                <span className="text-gray-500 text-xs">Checking...</span>
              )}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center justify-between gap-4 mt-2 text-xs">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-gray-400 hover:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoLoadLastFile}
                onChange={(e) =>
                  updateSetting("autoLoadLastFile", e.target.checked)
                }
                className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-1"
              />
              <span>Remember last file</span>
            </label>
            <label className="flex items-center gap-2 text-gray-400 hover:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStartWatching}
                onChange={(e) =>
                  updateSetting("autoStartWatching", e.target.checked)
                }
                className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-1"
              />
              <span>Auto-start watching</span>
            </label>
          </div>
          {/* Manual update check */}
          <button
            onClick={() => checkForUpdates()}
            disabled={isCheckingUpdate}
            className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            title="Check for updates"
          >
            🔄
          </button>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-300 bg-red-950/30 border border-red-900 p-2 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div className="bg-gray-950 border-b border-gray-800 flex-shrink-0">
        <FilterPanel filters={filters} setFilters={setFilters} />
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-hidden">
        <LogViewer logs={logs} filters={filters} />
      </div>
    </div>
  );
}

export default App;
