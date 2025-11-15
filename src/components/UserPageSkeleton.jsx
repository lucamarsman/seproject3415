import RestaurantCardSkeleton from "./RestaurantCardSkeleton";

export default function UserPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-white px-4 py-6 space-y-4">
        <div className="h-8 w-3/4 bg-gray-200 rounded skeleton-shimmer" />
        <div className="h-4 w-1/2 bg-gray-200 rounded skeleton-shimmer" />
        <div className="h-4 w-2/3 bg-gray-200 rounded skeleton-shimmer" />
        <div className="h-4 w-1/3 bg-gray-200 rounded skeleton-shimmer" />

        <hr className="my-2 border-gray-200" />

        <div className="mt-2 flex flex-col items-center space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-start w-[200px] h-10 rounded-lg bg-gray-200 skeleton-shimmer"
            >
              <div className="w-8 h-8 ml-2 mr-3 rounded-full bg-gray-300 skeleton-shimmer" />
              <div className="h-4 w-20 bg-gray-300 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Search bar / filters skeleton */}
        <div className="bg-white/80 rounded-md p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <div className="h-10 bg-gray-200 rounded skeleton-shimmer" />
            </div>
            <div className="w-40 h-10 bg-gray-200 rounded skeleton-shimmer" />
            <div className="w-32 h-10 bg-gray-200 rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Map skeleton */}
        <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <div className="h-72 md:h-80 lg:h-96 bg-gray-200 skeleton-shimmer" />
        </div>

        {/* Section title skeleton */}
        <div className="h-6 w-64 bg-gray-200 rounded skeleton-shimmer" />

        {/* Restaurant grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch auto-rows-fr">
          {Array.from({ length: 4 }).map((_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
