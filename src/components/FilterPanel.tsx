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
    <div className="p-4 bg-poe-dark">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-poe-gold">Filters</h3>
        <button
          onClick={clearAll}
          className="text-xs text-poe-text-muted hover:text-poe-gold transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* All filters and search in one row */}
      <div className="flex items-center gap-4">
        {/* Group filter buttons */}
        <div className="flex gap-2">
          <button
            onClick={selectGameplay}
            className="px-3 py-1 text-xs bg-poe-muted hover:bg-poe-border text-poe-gold rounded-sm transition-colors border border-poe-border"
          >
            🎮 Gameplay Only
          </button>
          <button
            onClick={selectSystem}
            className="px-3 py-1 text-xs bg-poe-darker hover:bg-poe-muted text-poe-text-dim rounded-sm transition-colors border border-poe-border"
          >
            ⚙️ System Only
          </button>
        </div>

        {/* Individual gameplay category filters */}
        <div className="flex flex-wrap gap-1">
          {gameplayCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleFilter(cat)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filters.includes(cat)
                  ? "bg-poe-muted hover:bg-poe-border text-poe-gold ring-1 ring-poe-gold-dim/50"
                  : "bg-poe-darker hover:bg-poe-muted text-poe-text-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Individual system category filters */}
        <div className="flex flex-wrap gap-1">
          {systemCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleFilter(cat)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filters.includes(cat)
                  ? "bg-poe-muted hover:bg-poe-border text-poe-text-dim ring-1 ring-poe-border"
                  : "bg-poe-black hover:bg-poe-darker text-poe-text-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Box - Right side */}
        <div className="relative ml-auto">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48 px-2 py-1 text-xs bg-poe-black border border-poe-border rounded-sm text-gray-300 placeholder-poe-text-muted focus:outline-hidden focus:border-poe-gold-dim focus:ring-1 focus:ring-poe-gold-dim/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-poe-text-muted hover:text-poe-gold transition-colors text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {(filters.length > 0 || searchTerm) && (
        <div className="text-xs text-poe-text-muted mt-3 pt-2 border-t border-poe-border">
          {filters.length > 0 && (
            <>
              <span className="font-medium text-poe-gold">Active:</span>{" "}
              {filters.join(", ")}
            </>
          )}
          {searchTerm && (
            <div className="mt-1">
              <span className="font-medium text-poe-text-dim">Search:</span>{" "}
              <span className="text-poe-gold">"{searchTerm}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
