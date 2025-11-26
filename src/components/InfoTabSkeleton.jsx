export default function InfoTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="skeleton-shimmer h-7 w-56 rounded" />

      {/* Banner skeleton */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-4 w-72 rounded" />
        <div className="skeleton-shimmer w-full h-48 md:h-56 lg:h-64 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton-shimmer flex-1 h-10 rounded" />
          <div className="skeleton-shimmer h-10 w-20 rounded" />
          <div className="skeleton-shimmer h-10 w-20 rounded" />
        </div>
      </div>

      {/* Current Details card */}
      <div className="mt-6 bg-gray-100 p-4 rounded shadow space-y-2">
        <div className="skeleton-shimmer h-5 w-40 rounded" />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton-shimmer h-4 w-3/4 rounded" />
        ))}
      </div>

      {/* Form skeleton */}
      <div className="mt-6 space-y-4 max-w-md">
        <div className="skeleton-shimmer h-6 w-48 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton-shimmer h-4 w-24 rounded" />
            <div className="skeleton-shimmer h-9 w-full rounded" />
          </div>
        ))}

        {/* Hours block */}
        <div className="mt-4 p-4 bg-white rounded shadow-inner space-y-3">
          <div className="skeleton-shimmer h-4 w-56 rounded" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton-shimmer h-4 w-16 rounded" />
              <div className="skeleton-shimmer h-8 w-20 rounded" />
              <div className="skeleton-shimmer h-8 w-20 rounded" />
            </div>
          ))}
        </div>

        <div className="skeleton-shimmer h-10 w-full rounded" />
      </div>
    </div>
  );
}
