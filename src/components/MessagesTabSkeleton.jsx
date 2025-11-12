export default function MessagesTabSkeleton() {
  return (
    <>
      <hr className="my-8 border-t-2 border-gray-300" />
      <div className="h-6 w-32 bg-gray-200 rounded skeleton-shimmer mt-2 mb-4" />
      <ul className="space-y-4 list-none p-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="border rounded p-4 shadow-sm bg-white border-gray-200 space-y-2"
          >
            <div className="flex justify-between items-start">
              <div className="h-4 w-3/4 bg-gray-200 rounded skeleton-shimmer" />
              <div className="h-3 w-28 bg-gray-200 rounded skeleton-shimmer ml-4" />
            </div>
            <div className="h-3 w-24 bg-gray-200 rounded skeleton-shimmer" />
            <div className="h-3 w-40 bg-gray-200 rounded skeleton-shimmer" />
          </li>
        ))}
      </ul>
    </>
  );
}