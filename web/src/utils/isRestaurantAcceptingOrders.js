// RESTAURANT AUTO-ACCEPT STATUS
export function isRestaurantAcceptingOrders(autoSetting) {
  if (!autoSetting) return true;
  const setting = String(autoSetting).toLowerCase();
  if (setting === "reject") return false;
  return true;
}