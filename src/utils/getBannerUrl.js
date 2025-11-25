//USED IN: BrowseRestaurants; UserPage/homeTab.jsx
export function getBannerUrl(r) {
  if (!r.bannerUrl) return null;
  const v = r.bannerUpdatedAt || 0;
  return v ? `${r.bannerUrl}?v=${v}` : r.bannerUrl;
}
