export default function RestaurantSettingsTabSkeleton() {
  return (
    <div className="mt-10 animate-pulse space-y-6">
      <div className="h-7 w-64 bg-gray-200 rounded" />

      {/* Auto handling card */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
        <div className="h-5 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-80 bg-gray-200 rounded" />
        <div className="w-60 h-10 bg-gray-200 rounded-full" />
      </div>

      {/* Service range card */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-80 bg-gray-200 rounded" />
        <div className="flex gap-4 items-end">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-10 w-32 bg-gray-200 rounded" />
          </div>
          <div className="h-10 w-32 bg-blue-200 rounded" />
        </div>
      </div>
    </div>
  );
}
