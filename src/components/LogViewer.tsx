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
  searchTerm: string;
}

export default function LogViewer({ logs, filters, searchTerm }: Props) {
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
      "Level Up": "text-poe-gold font-medium",
      Skill: "text-purple-400",
      Dialogue: "text-amber-400",
      Guild: "text-emerald-400",
      "Item Filter": "text-pink-400",
      Trade: "text-poe-gold font-medium",
      Gameplay: "text-orange-400",
      Network: "text-poe-text-dim",
      Downloads: "text-cyan-400",
      Graphics: "text-blue-400",
      Engine: "text-poe-text-muted",
      Audio: "text-indigo-400",
      Warnings: "text-red-400 font-medium",
    };
    return colors[cat] || "text-poe-text-muted";
  };

  const formatMessage = (log: LogEvent) => {
    let message = log.message;

    if (log.timestamp && message.startsWith(log.timestamp)) {
      message = message.substring(log.timestamp.length).trim();
    }

    if (log.category === "Trade" && message.includes("@From")) {
      const fromMatch = message.match(/@From ([^:]+): (.+)/);
      if (fromMatch) {
        const [, sender, tradeMessage] = fromMatch;
        return `💬 ${sender}: ${tradeMessage}`;
      }
    }

    if (log.category === "Skill" && message.includes("have received")) {
      message = message.replace(/have received ([^.]+)/, "gained $1");
    }

    if (log.category === "Level Up" && message.includes("is now level")) {
      message = message.replace(
        /(\w+) \([^)]+\) is now level (\d+)/,
        "🎉 $1 reached level $2!"
      );
    }

    if (log.category === "Death" && message.includes("has been slain")) {
      message = message.replace("has been slain", "💀 was slain");
    }

    return message;
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "??:??:??";
    const timePart = timestamp.split(" ")[1];
    return timePart || timestamp;
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(
      regex,
      '<mark class="bg-poe-gold/80 text-poe-black font-medium">$1</mark>'
    );
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

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Death: "💀",
      "Level Up": "🎉",
      Skill: "⭐",
      Trade: "💰",
      Dialogue: "💬",
      Guild: "🏛️",
      "Item Filter": "🔍",
      Gameplay: "🎮",
      Network: "🌐",
      Downloads: "📥",
      Graphics: "🎨",
      Engine: "⚙️",
      Audio: "🔊",
      Warnings: "⚠️",
    };
    return icons[category] || "📝";
  };

  const filteredLogs = logs.filter((log: LogEvent) => {
    const categoryMatch =
      filters.length === 0 || filters.includes(log.category);
    const searchMatch =
      !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <div className="h-full flex flex-col bg-poe-black">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#2a2a2a #0f0f0f",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-poe-text-muted">
            <div className="text-center">
              <div className="text-lg mb-2">📋</div>
              <div className="text-sm">
                {logs.length === 0
                  ? "No logs yet. Select a log file to start monitoring."
                  : searchTerm
                  ? `No logs match the search "${searchTerm}"`
                  : "No logs match the current filters."}
              </div>
              {logs.length > 0 && (filters.length > 0 || searchTerm) && (
                <div className="text-xs text-poe-text-muted/60 mt-1">
                  {logs.length} total logs available
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-px">
            {filteredLogs.map((log: LogEvent, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-3 hover:bg-poe-muted/30 px-2 py-0.5 rounded-sm group"
              >
                <span className="text-poe-text-muted shrink-0 w-16 text-right font-mono">
                  {formatTimestamp(log.timestamp)}
                </span>

                <span className="shrink-0 w-24 text-center">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.category === "Death"
                        ? "bg-red-950/60 text-red-400"
                        : log.category === "Level Up"
                        ? "bg-poe-muted text-poe-gold"
                        : log.category === "Skill"
                        ? "bg-purple-950/60 text-purple-400"
                        : log.category === "Dialogue"
                        ? "bg-amber-950/60 text-amber-400"
                        : log.category === "Guild"
                        ? "bg-emerald-950/60 text-emerald-400"
                        : log.category === "Item Filter"
                        ? "bg-pink-950/60 text-pink-400"
                        : log.category === "Trade"
                        ? "bg-poe-muted text-poe-gold"
                        : log.category === "Gameplay"
                        ? "bg-orange-950/60 text-orange-400"
                        : log.category === "Network"
                        ? "bg-poe-muted text-poe-text-dim"
                        : log.category === "Downloads"
                        ? "bg-cyan-950/60 text-cyan-400"
                        : log.category === "Graphics"
                        ? "bg-blue-950/60 text-blue-400"
                        : log.category === "Engine"
                        ? "bg-poe-muted text-poe-text-muted"
                        : log.category === "Audio"
                        ? "bg-indigo-950/60 text-indigo-400"
                        : log.category === "Warnings"
                        ? "bg-red-950/60 text-red-400"
                        : "bg-poe-muted text-poe-text-muted"
                    }`}
                    title={log.category}
                  >
                    <span className="mr-1">
                      {getCategoryIcon(log.category)}
                    </span>
                    {getCategoryDisplay(log.category)}
                  </span>
                </span>

                <span
                  className={`${getColor(
                    log.category
                  )} break-all flex-1 leading-relaxed`}
                  dangerouslySetInnerHTML={{
                    __html: highlightSearchTerm(formatMessage(log), searchTerm),
                  }}
                />
              </div>
            ))}
            <div ref={endRef}></div>
          </div>
        )}
      </div>

      <div className="bg-poe-darker border-t border-poe-border px-3 py-2 flex justify-between items-center text-xs text-poe-text-muted shrink-0">
        <span>
          {filteredLogs.length.toLocaleString()} of{" "}
          {logs.length.toLocaleString()} logs
        </span>
        <div className="flex gap-4">
          {filters.length > 0 && (
            <span className="text-poe-text-muted">
              {filters.length} filter{filters.length !== 1 ? "s" : ""} active
            </span>
          )}
          {searchTerm && (
            <span className="text-poe-gold">Search: "{searchTerm}"</span>
          )}
        </div>
      </div>
    </div>
  );
}
