import type { Dispatch, SetStateAction } from "react";

interface Props {
  filters: string[];
  setFilters: Dispatch<SetStateAction<string[]>>;
}

export default function FilterPanel({ filters, setFilters }: Props) {
  const categories = [
    "Death",
    "Level Up",
    "Skill",
    "Dialogue",
    "Guild",
    "Item Filter",
    "Trade",
    "Network",
    "Graphics",
    "Engine",
    "Audio",
    "Debug",
    "Warnings",
    "System",
  ];

  const gameplayCategories = [
    "Death",
    "Level Up",
    "Skill",
    "Dialogue",
    "Guild",
    "Item Filter",
    "Trade",
  ];
  const systemCategories = ["Network", "Graphics", "Engine", "Audio", "System"];
  const diagnosticCategories = ["Debug", "Warnings"];

  const toggleFilter = (cat: string) => {
    setFilters((prev) =>
      prev.includes(cat) ? prev.filter((f) => f !== cat) : [...prev, cat]
    );
  };

  const clearFilters = () => {
    setFilters([]);
  };

  const selectAll = () => {
    setFilters([...categories]);
  };

  const selectGameplayOnly = () => {
    setFilters([...gameplayCategories]);
  };

  const selectSystemOnly = () => {
    setFilters([...systemCategories]);
  };

  const selectDiagnosticsOnly = () => {
    setFilters([...diagnosticCategories]);
  };

  const selectPlayerActions = () => {
    setFilters(["Death", "Level Up", "Skill", "Trade"]);
  };

  return (
    <div className="p-3">
      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-medium text-gray-400">Quick:</span>
        <button
          onClick={selectPlayerActions}
          className="text-xs bg-emerald-900 hover:bg-emerald-800 text-emerald-100 px-2 py-1 rounded transition-colors"
        >
          Player
        </button>
        <button
          onClick={selectGameplayOnly}
          className="text-xs bg-green-900 hover:bg-green-800 text-green-100 px-2 py-1 rounded transition-colors"
        >
          Gameplay
        </button>
        <button
          onClick={selectSystemOnly}
          className="text-xs bg-blue-900 hover:bg-blue-800 text-blue-100 px-2 py-1 rounded transition-colors"
        >
          System
        </button>
        <button
          onClick={selectDiagnosticsOnly}
          className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-2 py-1 rounded transition-colors"
        >
          Diagnostics
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1"></div>
        <button
          onClick={selectAll}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded transition-colors"
        >
          All
        </button>
        <button
          onClick={clearFilters}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded transition-colors"
        >
          None
        </button>
      </div>

      {/* Category Filters */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div>
          <h4 className="text-xs font-medium text-emerald-400 mb-2">
            🎮 Gameplay
          </h4>
          <div className="flex flex-wrap gap-1">
            {gameplayCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filters.includes(cat)
                    ? "bg-emerald-800 hover:bg-emerald-700 text-emerald-100 ring-1 ring-emerald-600"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium text-blue-400 mb-2">⚙️ System</h4>
          <div className="flex flex-wrap gap-1">
            {systemCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filters.includes(cat)
                    ? "bg-blue-800 hover:bg-blue-700 text-blue-100 ring-1 ring-blue-600"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium text-red-400 mb-2">
            🔧 Diagnostics
          </h4>
          <div className="flex flex-wrap gap-1">
            {diagnosticCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filters.includes(cat)
                    ? "bg-red-800 hover:bg-red-700 text-red-100 ring-1 ring-red-600"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-800">
          <span className="font-medium text-gray-400">Active:</span>{" "}
          {filters.join(", ")}
        </div>
      )}
    </div>
  );
}
