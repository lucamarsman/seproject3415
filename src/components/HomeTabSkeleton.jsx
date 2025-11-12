import RestaurantCardSkeleton from "./RestaurantCardSkeleton";

export default function HomeTabSkeleton() {
  return (
    <>
      {/* Search / filters bar */}
      <div className="sticky top-0 z-10 bg-white/80 rounded-md p-4 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <div className="h-10 bg-gray-200 rounded skeleton-shimmer" />
            </div>
            <div className="w-36 h-10 bg-gray-200 rounded skeleton-shimmer" />
            <div className="w-28 h-10 bg-gray-200 rounded skeleton-shimmer" />
          </div>
          <div className="w-24 h-5 bg-gray-200 rounded skeleton-shimmer self-end" />
        </div>
      </div>

      {/* Map */}
      <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm mt-4 mb-4">
        <div className="h-72 md:h-80 lg:h-96 bg-gray-200 skeleton-shimmer" />
      </div>

      {/* Heading */}
      <div className="mt-8 h-6 w-64 bg-gray-200 rounded skeleton-shimmer" />

      {/* Cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch auto-rows-fr">
        {Array.from({ length: 4 }).map((_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
