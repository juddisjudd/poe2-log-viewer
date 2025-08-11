import { useEffect, useRef } from "react";

interface LogEvent {
  timestamp: string;
  category: string;
  message: string;
  raw: string;
}

interface Props {
  logs: LogEvent[];
  filters: string[];
}

export default function LogViewer({ logs, filters }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getColor = (cat: string) => {
    const colors: Record<string, string> = {
      Death: "text-red-400 font-medium",
      "Level Up": "text-emerald-400 font-medium",
      Skill: "text-purple-400",
      Dialogue: "text-yellow-300",
      Guild: "text-emerald-300",
      "Item Filter": "text-pink-400",
      Trade: "text-emerald-400 font-medium",
      Network: "text-orange-400",
      Downloads: "text-cyan-400",
      Graphics: "text-blue-400",
      Engine: "text-gray-500",
      Audio: "text-indigo-400",
      Debug: "text-gray-500 text-xs",
      Warnings: "text-red-300 font-medium",
      System: "text-gray-500",
    };
    return colors[cat] || "text-gray-400";
  };

  const formatMessage = (log: LogEvent) => {
    let message = log.message;
    if (log.timestamp && message.startsWith(log.timestamp)) {
      message = message.substring(log.timestamp.length).trim();
    }
    return message;
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "??:??:??";
    const timePart = timestamp.split(" ")[1];
    return timePart || timestamp;
  };

  const getCategoryDisplay = (category: string) => {
    const shortNames: Record<string, string> = {
      "Item Filter": "Filter",
      "Level Up": "LvlUp",
      Dialogue: "Dialog",
      Downloads: "Download",
      Graphics: "GFX",
      Warnings: "Warn",
    };
    return shortNames[category] || category;
  };

  const filteredLogs = logs.filter(
    (log) => filters.length === 0 || filters.includes(log.category)
  );

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Log content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#374151 #111827",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-lg mb-2">📋</div>
              <div className="text-sm">
                {logs.length === 0
                  ? "No logs yet. Select a log file to start monitoring."
                  : "No logs match the current filters."}
              </div>
              {logs.length > 0 && filters.length > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {logs.length} total logs available
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-px">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 hover:bg-gray-950/50 px-2 py-0.5 rounded group"
              >
                {/* Timestamp */}
                <span className="text-gray-600 shrink-0 w-16 text-right font-mono">
                  {formatTimestamp(log.timestamp)}
                </span>

                {/* Category - Increased width and better overflow handling */}
                <span className="shrink-0 w-24 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.category === "Death"
                        ? "bg-red-900/40 text-red-300"
                        : log.category === "Level Up"
                        ? "bg-emerald-900/40 text-emerald-300"
                        : log.category === "Skill"
                        ? "bg-purple-900/40 text-purple-300"
                        : log.category === "Dialogue"
                        ? "bg-yellow-900/40 text-yellow-300"
                        : log.category === "Guild"
                        ? "bg-emerald-900/40 text-emerald-300"
                        : log.category === "Item Filter"
                        ? "bg-pink-900/40 text-pink-300"
                        : log.category === "Trade"
                        ? "bg-emerald-900/40 text-emerald-300"
                        : log.category === "Network"
                        ? "bg-orange-900/40 text-orange-300"
                        : log.category === "Downloads"
                        ? "bg-cyan-900/40 text-cyan-300"
                        : log.category === "Graphics"
                        ? "bg-blue-900/40 text-blue-300"
                        : log.category === "Engine"
                        ? "bg-gray-800/60 text-gray-400"
                        : log.category === "Audio"
                        ? "bg-indigo-900/40 text-indigo-300"
                        : log.category === "Debug"
                        ? "bg-gray-800/60 text-gray-500"
                        : log.category === "Warnings"
                        ? "bg-red-900/40 text-red-300"
                        : "bg-gray-800/60 text-gray-400"
                    }`}
                    title={log.category}
                  >
                    {getCategoryDisplay(log.category)}
                  </span>
                </span>

                {/* Message */}
                <span
                  className={`${getColor(
                    log.category
                  )} break-all flex-1 leading-relaxed`}
                >
                  {formatMessage(log)}
                </span>
              </div>
            ))}
            <div ref={endRef}></div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-gray-950 border-t border-gray-800 px-3 py-2 flex justify-between items-center text-xs text-gray-500 flex-shrink-0">
        <span>
          {filteredLogs.length.toLocaleString()} of{" "}
          {logs.length.toLocaleString()} logs
        </span>
        {filters.length > 0 && (
          <span className="text-gray-600">
            {filters.length} filter{filters.length !== 1 ? "s" : ""} active
          </span>
        )}
      </div>
    </div>
  );
}
