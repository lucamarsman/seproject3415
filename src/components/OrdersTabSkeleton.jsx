export default function OrdersTabSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-7 w-72 bg-gray-200 rounded" />
      <div className="h-px w-full bg-gray-200" />

      {/* New Orders */}
      <section>
        <div className="h-6 w-52 bg-gray-200 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border rounded p-4 bg-yellow-50 border-yellow-200 mb-4"
          >
            <div className="flex justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-56 bg-gray-200 rounded" />
              </div>
              <div className="w-40 h-16 bg-yellow-200 rounded" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="h-9 bg-gray-200 rounded" />
              <div className="h-9 bg-green-200 rounded" />
              <div className="h-9 bg-red-200 rounded" />
            </div>
          </div>
        ))}
      </section>

      {/* Confirmed Orders */}
      <section>
        <div className="h-6 w-52 bg-gray-200 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 rounded p-4 bg-green-50 border-green-200 mb-4"
          >
            <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-px bg-gray-200 my-3" />
            <div className="h-4 w-52 bg-gray-200 rounded mb-2" />
            <div className="flex gap-6 mt-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-40 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </section>

      {/* Courier Confirmed */}
      <section>
        <div className="h-6 w-64 bg-gray-200 rounded mb-4" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border-2 rounded p-4 bg-green-50 border-green-200 mb-4"
          >
            <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-px bg-gray-200 my-3" />
            <div className="h-4 w-52 bg-gray-200 rounded mb-2" />
            <div className="flex gap-6 mt-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-40 bg-gray-200 rounded" />
            </div>
            <div className="h-9 w-40 bg-indigo-200 rounded mt-3" />
          </div>
        ))}
      </section>
    </div>
  );
}
