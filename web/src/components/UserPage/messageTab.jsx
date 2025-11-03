export default function MessagesTab({ userMessages = [] }) {
  return (
    <>
      <hr className="my-8 border-t-2 border-gray-300" />
      <h2 className="text-xl font-bold mt-8 mb-4">Messages</h2>
      {!userMessages || userMessages.length === 0 ? (
        <p className="text-gray-600 italic">No new messages.</p>
      ) : (
        <ul className="space-y-4 list-none p-0">
          {userMessages.map((msg) => (
            <li
              key={msg.messageId}
              className={`border rounded p-4 shadow-sm ${
                msg.read === false
                  ? "bg-blue-50 border-blue-300"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-lg">{msg.message}</p>
                <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                  {
                    msg.createdAt 
                      ? (typeof msg.createdAt.toDate === 'function' 
                        ? msg.createdAt.toDate().toLocaleString()
                        : new Date(msg.createdAt).toLocaleString()
                       ) 
                      : 'No Date'
                  }
                </span>
              </div>
              {msg.read === false && (
                <span className="inline-block text-xs font-medium text-blue-600"> NEW</span>
              )}
              {msg.orderId && (
                <p className="text-sm text-gray-600 mt-1">
                  Related to Order ID: {msg.orderId}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}