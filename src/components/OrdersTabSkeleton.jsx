export default function OrdersTabSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton-shimmer h-7 w-72 rounded" />
      <div className="skeleton-shimmer h-px w-full" />

      {/* New Orders */}
      <section>
        <div className="skeleton-shimmer h-6 w-52 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border rounded p-4 bg-yellow-50 border-yellow-200 mb-4"
          >
            <div className="flex justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-40 rounded" />
                <div className="skeleton-shimmer h-4 w-32 rounded" />
                <div className="skeleton-shimmer h-4 w-48 rounded" />
                <div className="skeleton-shimmer h-4 w-56 rounded" />
              </div>
              <div className="skeleton-shimmer w-40 h-16 rounded bg-yellow-200" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="skeleton-shimmer h-9 rounded" />
              <div className="skeleton-shimmer h-9 rounded bg-green-200" />
              <div className="skeleton-shimmer h-9 rounded bg-red-200" />
            </div>
          </div>
        ))}
      </section>

      {/* Confirmed Orders */}
      <section>
        <div className="skeleton-shimmer h-6 w-52 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 rounded p-4 bg-green-50 border-green-200 mb-4"
          >
            <div className="skeleton-shimmer h-4 w-40 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />
            <div className="skeleton-shimmer h-px my-3" />
            <div className="skeleton-shimmer h-4 w-52 rounded mb-2" />

            <div className="flex gap-6 mt-2">
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="skeleton-shimmer h-4 w-40 rounded" />
            </div>
          </div>
        ))}
      </section>

      {/* Courier Confirmed */}
      <section>
        <div className="skeleton-shimmer h-6 w-64 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 rounded p-4 bg-green-50 border-green-200 mb-4"
          >
            <div className="skeleton-shimmer h-4 w-40 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />
            <div className="skeleton-shimmer h-px my-3" />
            <div className="skeleton-shimmer h-4 w-52 rounded mb-2" />

            <div className="flex gap-6 mt-2">
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="skeleton-shimmer h-4 w-40 rounded" />
            </div>

            <div className="skeleton-shimmer h-9 w-40 rounded bg-indigo-200 mt-3" />
          </div>
        ))}
      </section>
    </div>
  );
}
