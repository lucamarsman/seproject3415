import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function BannerManager({ restaurant }) {
  const docId = restaurant.id ?? restaurant.restaurantId;

  const [url, setUrl] = useState(restaurant.bannerUrl || "");
  const [updatedAt, setUpdatedAt] = useState(restaurant.bannerUpdatedAt || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(restaurant.bannerUrl || "");
    setUpdatedAt(restaurant.bannerUpdatedAt || 0);
  }, [restaurant.bannerUrl, restaurant.bannerUpdatedAt]);

  function looksLikeUrl(s) {
    try {
      const u = new URL(s);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function save() {
    setError("");
    const trimmed = url.trim();
    if (trimmed && !looksLikeUrl(trimmed)) {
      setError("Please enter a valid HTTPS image URL.");
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      await updateDoc(doc(db, "restaurants", docId), {
        bannerUrl: trimmed || null,
        bannerUpdatedAt: now,
      });
      setUrl(trimmed);
      setUpdatedAt(now);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearBanner() {
    setSaving(true);
    try {
      const now = Date.now();
      await updateDoc(doc(db, "restaurants", docId), {
        bannerUrl: null,
        bannerUpdatedAt: now,
      });
      setUrl("");
      setUpdatedAt(now);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const cacheBuster = updatedAt ? `?v=${updatedAt}` : "";
  const shown = url ? `${url}${cacheBuster}` : null;

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        Paste a public HTTPS image URL (JPG/PNG/WebP). Recommended 1920×640
        (~3:1).
      </div>

      <div className="w-full h-48 md:h-56 lg:h-64 rounded-lg overflow-hidden border bg-gray-100">
        {shown ? (
          <img
            src={shown}
            alt="Restaurant banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-gray-500">
            No banner set
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://preview.colorkit.co/color/2563eb.png?size=wallpaper&static=true"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 border rounded-md px-3 py-2"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {Boolean(url) && (
          <button
            onClick={clearBanner}
            disabled={saving}
            className="px-3 py-2 rounded-md bg-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
