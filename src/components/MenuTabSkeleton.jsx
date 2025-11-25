export default function MenuTabSkeleton() {
  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="skeleton-shimmer h-7 w-48 rounded" />

      {/* Add item form */}
      <div className="mt-2 space-y-4 bg-gray-50 p-4 rounded shadow max-w-2xl">
        <div className="skeleton-shimmer h-6 w-56 rounded" />
        <div className="skeleton-shimmer h-9 w-full rounded" />
        <div className="skeleton-shimmer h-20 w-full rounded" />

        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer h-9 rounded" />
          ))}
        </div>

        {/* Modifications box */}
        <div className="border border-gray-300 p-3 rounded space-y-3 bg-white">
          <div className="skeleton-shimmer h-4 w-52 rounded" />
          <div className="skeleton-shimmer h-8 rounded" />
          <div className="flex gap-2">
            <div className="skeleton-shimmer flex-grow h-8 rounded" />
            <div className="skeleton-shimmer w-20 h-8 rounded" />
          </div>
          <div className="skeleton-shimmer h-8 w-full rounded" />
        </div>

        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-4 w-4 rounded" />
          <div className="skeleton-shimmer h-4 w-24 rounded" />
        </div>

        <div className="skeleton-shimmer h-10 w-full rounded" />
      </div>

      {/* Menu list */}
      <div className="space-y-4">
        <div className="skeleton-shimmer h-6 w-64 rounded" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border rounded p-4 flex flex-col sm:flex-row sm:items-start gap-4 bg-white shadow"
          >
            <div className="skeleton-shimmer w-[100px] h-[100px] rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-5 w-40 rounded" />
              <div className="skeleton-shimmer h-10 w-full rounded" />
              <div className="flex gap-2">
                <div className="skeleton-shimmer h-8 w-full rounded" />
                <div className="skeleton-shimmer h-8 w-full rounded" />
                <div className="skeleton-shimmer h-8 w-full rounded" />
              </div>
              <div className="skeleton-shimmer h-8 w-full rounded" />
              <div className="flex gap-2">
                <div className="skeleton-shimmer h-8 w-24 rounded" />
                <div className="skeleton-shimmer h-8 w-24 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
