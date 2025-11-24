export default function InfoTabSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-56 bg-gray-200 rounded" />

      {/* Banner skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-72 bg-gray-200 rounded" />
        <div className="w-full h-48 md:h-56 lg:h-64 rounded-lg bg-gray-200" />
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded" />
          <div className="h-10 w-20 bg-gray-200 rounded" />
          <div className="h-10 w-20 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Current Details card */}
      <div className="mt-6 bg-gray-100 p-4 rounded shadow space-y-2">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-4 w-3/4 bg-gray-200 rounded" />
        ))}
      </div>

      {/* Form skeleton */}
      <div className="mt-6 space-y-4 max-w-md">
        <div className="h-6 w-48 bg-gray-200 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-9 w-full bg-gray-200 rounded" />
          </div>
        ))}

        {/* Hours block */}
        <div className="mt-4 p-4 bg-white rounded shadow-inner space-y-3">
          <div className="h-4 w-56 bg-gray-200 rounded" />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-8 w-20 bg-gray-200 rounded" />
              <div className="h-8 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>

        <div className="h-10 w-full bg-blue-200 rounded" />
      </div>
    </div>
  );
}
