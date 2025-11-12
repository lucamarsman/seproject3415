export default function RestaurantCardSkeleton() {
  return (
    <div className="flex flex-col h-full rounded-lg shadow-sm bg-white overflow-hidden">
      <div className="relative w-full aspect-[5/1] bg-gray-200 skeleton-shimmer" />
      <div className="flex-1 p-4 flex flex-col justify-between space-y-3">
        <div className="h-4 bg-gray-200 rounded skeleton-shimmer w-3/4" />
        <div className="h-3 bg-gray-200 rounded skeleton-shimmer w-1/2" />
        <div className="h-3 bg-gray-200 rounded skeleton-shimmer w-2/3" />
      </div>
    </div>
  );
}