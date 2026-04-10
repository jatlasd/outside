export function formatLocationCoordinates(location) {
  const lat = Number(location?.latitude);
  const lon = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}
