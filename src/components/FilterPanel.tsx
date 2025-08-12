import type { Dispatch, SetStateAction } from "react";

interface Props {
  filters: string[];
  setFilters: Dispatch<SetStateAction<string[]>>;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
}

export default function FilterPanel({
  filters,
  setFilters,
  searchTerm,
  setSearchTerm,
}: Props) {
  const gameplayCategories = [
    "Death",
    "Level Up",
    "Skill",
    "Trade",
    "Dialogue",
    "Guild",
    "Gameplay",
  ];

  const systemCategories = [
    "Network",
    "Item Filter",
    "Graphics",
    "Engine",
    "Audio",
    "Warnings",
  ];

  const toggleFilter = (category: string) => {
    if (filters.includes(category)) {
      setFilters(filters.filter((f) => f !== category));
    } else {
      setFilters([...filters, category]);
    }
  };

  const clearAll = () => {
    setFilters([]);
    setSearchTerm("");
  };

  const selectGameplay = () => {
    setFilters(gameplayCategories);
  };

  const selectSystem = () => {
    setFilters(systemCategories);
  };

  return (
    <div className="p-4 bg-gray-950">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Filters</h3>
        <button
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Quick Actions - Horizontal layout */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={selectGameplay}
          className="px-3 py-1 text-xs bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 rounded transition-colors"
        >
          🎮 Gameplay Only
        </button>
        <button
          onClick={selectSystem}
          className="px-3 py-1 text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 rounded transition-colors"
        >
          ⚙️ System Only
        </button>
      </div>

      {/* Categories - Properly aligned layout */}
      <div className="flex gap-6">
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

        <div className="flex-1">
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

        {/* Search Box - Separate column */}
        <div className="flex-shrink-0">
          <h4 className="text-xs font-medium text-gray-400 mb-2">🔍 Search</h4>
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {(filters.length > 0 || searchTerm) && (
        <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-800">
          {filters.length > 0 && (
            <>
              <span className="font-medium text-gray-400">Active:</span>{" "}
              {filters.join(", ")}
            </>
          )}
          {searchTerm && (
            <div className="mt-1">
              <span className="font-medium text-gray-400">Search:</span>{" "}
              <span className="text-blue-400">"{searchTerm}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
