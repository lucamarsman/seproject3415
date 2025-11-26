export default function RestaurantSettingsTabSkeleton() {
  return (
    <div className="mt-10 space-y-6">
      <div className="skeleton-shimmer h-7 w-64 rounded" />

      {/* Auto-handling card */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
        <div className="skeleton-shimmer h-5 w-56 rounded" />
        <div className="skeleton-shimmer h-4 w-80 rounded" />
        <div className="skeleton-shimmer h-10 w-60 rounded-full" />
      </div>

      {/* Service range card */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
        <div className="skeleton-shimmer h-5 w-48 rounded" />
        <div className="skeleton-shimmer h-4 w-80 rounded" />

        <div className="flex gap-4 items-end">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-4 w-20 rounded" />
            <div className="skeleton-shimmer h-10 w-32 rounded" />
          </div>

          <div className="skeleton-shimmer h-10 w-32 rounded" />
        </div>
      </div>
    </div>
  );
}
