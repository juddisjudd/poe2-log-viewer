import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
  const [searchTerm, setSearchTerm] = useState<string>("");
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
  const [lastCheckResult, setLastCheckResult] = useState<
    "none" | "up-to-date" | "available" | "error"
  >("none");
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

      await new Promise((resolve) => setTimeout(resolve, 800));

      if (isNewerVersion(latestVersion, version)) {
        setUpdateInfo({
          available: true,
          version: latestVersion,
          downloadUrl: release.html_url,
        });
        setLastCheckResult("available");
      } else {
        setUpdateInfo({ available: false });
        setLastCheckResult("up-to-date");
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateInfo({ available: false });
      setLastCheckResult("error");
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
      const result = await invoke<string>("start_watching", {
        path: filePath,
      });
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

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  const handleDragStart = async (e: React.MouseEvent) => {
    // Only start drag if clicking on the titlebar itself, not buttons
    if ((e.target as HTMLElement).closest('button')) return;
    const window = getCurrentWindow();
    await window.startDragging();
  };

  return (
    <div className="h-screen bg-poe-black text-gray-100 flex flex-col overflow-hidden">
      {/* Custom Titlebar */}
      <div 
        className="bg-poe-darker border-b border-poe-border px-3 py-1.5 flex items-center justify-between flex-shrink-0 select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-poe-gold">
            POE2 Log Viewer
          </h1>
          <span className="text-xs text-poe-textMuted">
            v{currentVersion}
          </span>
          {updateInfo.available && (
            <button
              onClick={handleUpdateClick}
              className="bg-poe-forest hover:bg-poe-moss/50 text-poe-gold px-2 py-0.5 rounded text-xs font-medium transition-colors animate-pulse border border-poe-moss/50"
              title={`Update available: v${updateInfo.version}`}
            >
              ↗ v{updateInfo.version}
            </button>
          )}
          {isCheckingUpdate ? (
            <span className="text-xs text-poe-goldDim animate-pulse">
              Checking...
            </span>
          ) : (
            <button
              onClick={() => checkForUpdates()}
              className="text-poe-textMuted hover:text-poe-gold transition-all duration-200 text-xs"
              title="Check for updates"
            >
              {lastCheckResult === "up-to-date" ? "✓" : lastCheckResult === "error" ? "✗" : "🔄"}
            </button>
          )}
        </div>
        
        <button
          onClick={handleClose}
          className="text-poe-textMuted hover:text-red-400 hover:bg-poe-blood/50 px-2 py-0.5 rounded transition-colors text-sm font-medium"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Main Header/Controls */}
      <div className="bg-poe-dark border-b border-poe-border p-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* File info */}
          <div className="text-sm text-poe-textDim">
            {currentFile ? (
              <span>
                <span className="text-poe-textMuted">File:</span>
                <span className="text-gray-300 ml-1" title={currentFile}>
                  {getShortPath(currentFile)}
                </span>
              </span>
            ) : (
              <span className="text-poe-textMuted">No file selected</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-poe-textDim">
              <span className="text-poe-textMuted">Logs:</span>
              <span className="text-poe-gold ml-1 font-medium">
                {logs.length.toLocaleString()}
              </span>
            </div>
            <button
              onClick={pickFile}
              className="bg-poe-muted hover:bg-poe-border text-poe-gold px-3 py-1.5 rounded text-sm font-medium transition-colors border border-poe-border"
            >
              Select File
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center gap-4 mt-2 text-xs">
          <label className="flex items-center gap-2 text-poe-textMuted hover:text-poe-gold cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={settings.autoLoadLastFile}
              onChange={(e) =>
                updateSetting("autoLoadLastFile", e.target.checked)
              }
              className="w-3 h-3 rounded border-poe-border bg-poe-dark text-poe-gold focus:ring-poe-gold focus:ring-1 accent-poe-gold"
            />
            <span>Remember last file</span>
          </label>
          <label className="flex items-center gap-2 text-poe-textMuted hover:text-poe-gold cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={settings.autoStartWatching}
              onChange={(e) =>
                updateSetting("autoStartWatching", e.target.checked)
              }
              className="w-3 h-3 rounded border-poe-border bg-poe-dark text-poe-gold focus:ring-poe-gold focus:ring-1 accent-poe-gold"
            />
            <span>Auto-start watching</span>
          </label>
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-300 bg-poe-blood/30 border border-poe-crimson p-2 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div className="bg-poe-dark border-b border-poe-border flex-shrink-0">
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-hidden">
        <LogViewer logs={logs} filters={filters} searchTerm={searchTerm} />
      </div>
    </div>
  );
}

export default App;
