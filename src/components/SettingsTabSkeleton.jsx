export default function SettingsTabSkeleton() {
  return (
    <>
      {/* Avatar skeleton */}
      <div className="flex flex-col items-center mt-8 relative">
        <div className="relative w-32 h-32">
          <div className="w-32 h-32 rounded-full bg-gray-200 skeleton-shimmer border-4 border-white shadow-md" />
        </div>
      </div>

      <hr className="my-8 border-t-2 border-gray-300" />

      {/* Form skeleton */}
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-xl p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 w-24 bg-gray-200 rounded skeleton-shimmer mb-2" />
            <div className="h-10 w-full bg-gray-200 rounded skeleton-shimmer" />
          </div>
        ))}

        {/* Message / status area */}
        <div className="h-6 w-full bg-gray-100 rounded skeleton-shimmer" />

        {/* Button */}
        <div className="flex justify-end pt-4">
          <div className="h-10 w-32 bg-blue-300 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </>
  );
}
