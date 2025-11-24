export default function RestaurantPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <aside className="hidden md:block w-52 border-r border-gray-200 bg-white p-4">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-5 w-32 rounded-md" />
        </div>

        <div className="mt-6 space-y-2">
          <div className="skeleton-shimmer h-9 w-full rounded-md" />
          <div className="skeleton-shimmer h-9 w-full rounded-md" />
          <div className="skeleton-shimmer h-9 w-full rounded-md" />
          <div className="skeleton-shimmer h-9 w-full rounded-md" />
          <div className="skeleton-shimmer h-9 w-full rounded-md" />
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="skeleton-shimmer h-8 w-72 rounded-md" />
        <div className="skeleton-shimmer h-6 w-96 rounded-md" />

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="skeleton-shimmer h-40 rounded-xl" />
          <div className="skeleton-shimmer h-40 rounded-xl" />
        </div>

        <div className="skeleton-shimmer h-6 w-40 rounded-md mt-6" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="skeleton-shimmer h-28 rounded-xl" />
          <div className="skeleton-shimmer h-28 rounded-xl" />
          <div className="skeleton-shimmer h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
