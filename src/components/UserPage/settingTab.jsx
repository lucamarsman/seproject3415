import { useState } from "react";

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
  profileImgInput,
  setProfileImgInput
}) {
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  return (
    <>
      <div className="flex flex-col items-center mt-8 relative">
        <div className="relative w-32 h-32">
          <img
            src={profileImgInput || defaultProfileImg}
            alt="Profile"
            className="w-32 h-32 object-cover rounded-full border-4 border-white shadow-md"
          />
          <button
            type="button"
            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md transition-all cursor-pointer"
            onClick={() => {
              onClearMessages?.();
              setAvatarUrl(profileImgInput || "");
              setShowAvatarPopup(true);
            }}        
          >
            <img src={editIcon} alt="Edit" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showAvatarPopup && (
          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-3 relative">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/my-avatar.png"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setShowAvatarPopup(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 text-xs rounded bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!avatarUrl.trim()}
                  onClick={() => {
                    setProfileImgInput(avatarUrl.trim()); 
                    setShowAvatarPopup(false);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}


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
