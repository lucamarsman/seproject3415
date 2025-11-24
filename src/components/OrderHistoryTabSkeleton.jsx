export default function OrderHistoryTabSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-7 w-72 bg-gray-200 rounded" />
      <div className="h-4 w-96 bg-gray-200 rounded" />

      {/* Rejected / Timed-out */}
      <section className="mt-4">
        <div className="h-6 w-80 bg-gray-200 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 border-red-200 rounded p-4 bg-white shadow-sm mb-3"
          >
            <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-56 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
            <div className="space-y-1">
              <div className="h-4 w-64 bg-gray-200 rounded" />
              <div className="h-4 w-52 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </section>

      {/* Completed / picked up */}
      <section className="mt-6">
        <div className="h-6 w-72 bg-gray-200 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 border-green-200 rounded p-4 bg-white shadow-sm mb-3"
          >
            <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-56 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="space-y-1">
              <div className="h-4 w-64 bg-gray-200 rounded" />
              <div className="h-4 w-52 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
