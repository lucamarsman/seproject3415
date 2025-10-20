export default function SettingsTab({
  defaultProfileImg,
  editIcon,
  nameInput,
  setNameInput,
  emailInput,
  setEmailInput,
  phoneInput,
  setPhoneInput,
  addressInput,
  setAddressInput,
  savingProfile,
  onSubmit,
  formError,
  formSuccess,
  onClearMessages,
}) {
  return (
    <>
      <div className="flex flex-col items-center mt-8 relative">
        <div className="relative w-32 h-32">
          <img
            src={defaultProfileImg}
            alt="Profile"
            className="w-32 h-32 object-cover rounded-full border-4 border-white shadow-md"
          />
          <button
            type="button"
            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md transition-all cursor-pointer"
          >
            <img src={editIcon} alt="Edit" className="w-4 h-4" />
          </button>
        </div>
      </div>

      <hr className="my-8 border-t-2 border-gray-300" />

      <form
        onSubmit={onSubmit}
        className="max-w-2xl mx-auto bg-white shadow-md rounded-xl p-6 space-y-5"
      >
        <div>
          <label className="block text-gray-700 font-medium mb-1">Name</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={nameInput}
            onChange={(e) => {
              onClearMessages();
              setNameInput(e.target.value);
            }}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={emailInput}
            onChange={(e) => {
              onClearMessages();
              setEmailInput(e.target.value);
            }}
            placeholder="name@example.com"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">Phone</label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={phoneInput}
            onChange={(e) => {
              onClearMessages();
              setPhoneInput(e.target.value);
            }}
            placeholder="555-123-4567"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-1">
            Address
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={addressInput}
            onChange={(e) => {
              onClearMessages();
              setAddressInput(e.target.value);
            }}
            placeholder="123 Main St, City, Country"
          />
        </div>

        <div className="min-h-[56px]">
          {formError && (
            <div
              role="alert"
              className="text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-2"
            >
              {formError}
            </div>
          )}
          {!formError && formSuccess && (
            <div
              role="status"
              className="text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2"
            >
              {formSuccess}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all cursor-pointer"
            disabled={savingProfile}
          >
            {savingProfile ? "Saving..." : "Update"}
          </button>
        </div>
      </form>
    </>
  );
}
