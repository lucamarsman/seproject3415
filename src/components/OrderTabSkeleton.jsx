export default function OrdersTabSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border rounded p-4 bg-yellow-50 border-yellow-200 shadow-sm space-y-3"
        >
          {/* Top section */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded skeleton-shimmer" />
              <div className="h-4 w-52 bg-gray-200 rounded skeleton-shimmer" />
              <div className="h-4 w-56 bg-gray-200 rounded skeleton-shimmer" />
              <div className="h-4 w-32 bg-gray-200 rounded skeleton-shimmer" />
              <div className="h-4 w-64 bg-gray-200 rounded skeleton-shimmer" />
            </div>

            <div className="bg-yellow-300 text-yellow-900 text-xs font-bold py-2 px-3 rounded-tr rounded-bl shadow-md">
              <div className="h-3 w-24 bg-yellow-200 rounded skeleton-shimmer" />
            </div>
          </div>

          {/* Items list skeleton */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded skeleton-shimmer" />
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="py-2 px-2  rounded bg-gray-50 space-y-2"
              >
                <div className="h-4 w-40 bg-gray-200 rounded skeleton-shimmer" />
                <div className="h-3 w-32 bg-gray-200 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>

          {/* Notes section skeleton */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <div className="h-4 w-28 bg-gray-200 rounded skeleton-shimmer" />
            <div className="h-4 w-full bg-gray-200 rounded skeleton-shimmer" />
            <div className="h-4 w-3/4 bg-gray-200 rounded skeleton-shimmer" />
          </div>

          {/* Textarea + button skeleton */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <div className="h-4 w-40 bg-gray-200 rounded skeleton-shimmer" />
            <div className="h-16 w-full bg-gray-200 rounded skeleton-shimmer" />
            <div className="h-10 w-full bg-gray-300 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}