export default function MenuTabSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-7 w-48 bg-gray-200 rounded" />

      {/* Add item form */}
      <div className="mt-2 space-y-4 bg-gray-50 p-4 rounded shadow max-w-2xl">
        <div className="h-6 w-56 bg-gray-200 rounded" />
        <div className="h-9 w-full bg-gray-200 rounded" />
        <div className="h-20 w-full bg-gray-200 rounded" />

        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 bg-gray-200 rounded" />
          ))}
        </div>

        {/* Modifications box */}
        <div className="border border-gray-300 p-3 rounded space-y-3 bg-white">
          <div className="h-4 w-52 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="flex gap-2">
            <div className="flex-grow h-8 bg-gray-200 rounded" />
            <div className="w-20 h-8 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-full bg-gray-200 rounded" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>

        <div className="h-10 w-full bg-green-200 rounded" />
      </div>

      {/* Menu list */}
      <div className="space-y-4">
        <div className="h-6 w-64 bg-gray-200 rounded" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="border rounded p-4 flex flex-col sm:flex-row sm:items-start gap-4 bg-white shadow"
          >
            <div className="w-[100px] h-[100px] bg-gray-200 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-10 w-full bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-full bg-gray-200 rounded" />
                <div className="h-8 w-full bg-gray-200 rounded" />
                <div className="h-8 w-full bg-gray-200 rounded" />
              </div>
              <div className="h-8 w-full bg-gray-200 rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-gray-200 rounded" />
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

