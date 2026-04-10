const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/

export function normalizeUsZip(input) {
  const zip = String(input ?? "").trim()
  if (!ZIP_PATTERN.test(zip)) {
    throw new Error("Enter a valid US ZIP code.")
  }
  return zip.slice(0, 5)
}

export async function resolveZipToLocation(input) {
  const zip = normalizeUsZip(input)
  const response = await fetch(
    `https://api.zippopotam.us/us/${encodeURIComponent(zip)}`,
  )
  if (response.status === 404) {
    throw new Error("No location found for that ZIP code.")
  }
  if (!response.ok) {
    throw new Error("ZIP lookup failed. Try again.")
  }
  const payload = await response.json()
  const first = payload?.places?.[0]
  if (!first) {
    throw new Error("No location found for that ZIP code.")
  }
  const latitude = Number(first.latitude)
  const longitude = Number(first.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("ZIP lookup returned invalid coordinates.")
  }
  const parts = [first["place name"], first["state abbreviation"], "US"].filter(
    Boolean,
  )
  const label = parts.length ? parts.join(", ") : `ZIP ${zip}`
  return {
    source: "zip",
    latitude,
    longitude,
    label,
    zip,
  }
}
