import React from "react";

export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  clearTypes,
  toggleType,
  resultCount,
}) {
  const resultLabel = `${resultCount} ${
    resultCount === 1 ? "result" : "results"
  }`;

  return (
    <div className="sticky top-[64px] z-10 bg-white/90 backdrop-blur-md rounded-md p-4 shadow-sm mb-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Search input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search…"
              className="w-full pl-10 pr-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 bottom-2.5 w-5 h-5 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
              />
            </svg>
          </div>

          {/* Sort select */}
          <div className="inline-flex items-center gap-2 shrink-0">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap m-0">
              Sort by:
            </label>
            <select
              id="sortBy"
              value={filters.sort}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sort: e.target.value }))
              }
              className="border rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="distance">Distance</option>
              <option value="rating">Rating</option>
              <option value="name">Name (A→Z)</option>
            </select>
          </div>

          {/* Availability toggle */}
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Availability
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
              <input
                type="checkbox"
                checked={filters.openNow}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, openNow: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Open now
            </label>
          </div>
        </div>

        {/* Result count */}
        <div
          className="flex-none w-28 text-right text-sm text-gray-500 self-end tabular-nums select-none"
          aria-live="polite"
        >
          {resultLabel}
        </div>
      </div>

      {/* Active type filters */}
      {filters.types.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {filters.types.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className="px-2.5 py-1 rounded-full border text-xs bg-blue-50 border-blue-200 text-blue-700 cursor-pointer"
              title="Remove filter"
            >
              {t} ×
            </button>
          ))}
          <button
            onClick={clearTypes}
            className="text-xs text-blue-700 hover:underline cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
