export default function OrderHistoryTabSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton-shimmer h-7 w-72 rounded" />
      <div className="skeleton-shimmer h-4 w-96 rounded" />

      {/* Rejected / Timed-out */}
      <section className="mt-4">
        <div className="skeleton-shimmer h-6 w-80 rounded mb-4" />

        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 border-red-200 rounded p-4 bg-white shadow-sm mb-3"
          >
            <div className="skeleton-shimmer h-4 w-40 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-56 rounded mb-3" />
            <div className="skeleton-shimmer h-4 w-24 rounded mb-1" />

            <div className="space-y-1">
              <div className="skeleton-shimmer h-4 w-64 rounded" />
              <div className="skeleton-shimmer h-4 w-52 rounded" />
            </div>
          </div>
        ))}
      </section>

      {/* Completed / picked up */}
      <section className="mt-6">
        <div className="skeleton-shimmer h-6 w-72 rounded mb-4" />

        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 border-green-200 rounded p-4 bg-white shadow-sm mb-3"
          >
            <div className="skeleton-shimmer h-4 w-40 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />
            <div className="skeleton-shimmer h-4 w-56 rounded mb-3" />
            <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />

            <div className="space-y-1">
              <div className="skeleton-shimmer h-4 w-64 rounded" />
              <div className="skeleton-shimmer h-4 w-52 rounded" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
