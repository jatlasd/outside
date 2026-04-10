import { DEFAULT_FLAGS, PARAMS } from "@/lib/paramConfig"

export const PARAM_STORAGE_KEY = "weather-included-params"
export const WEIGHT_STORAGE_KEY = "weather-param-weights"
export const LOCATION_STORAGE_KEY = "weather-location"

export const DEFAULT_LOCATION = {
  source: "default",
  latitude: 52.52,
  longitude: 13.41,
  label: "Berlin area",
  zip: "",
}

const DEFAULT_WEIGHTS = Object.fromEntries(PARAMS.map((p) => [p.id, 1]))

export const WEIGHT_LEVEL_OPTIONS = [
  { value: 0, label: "Ignore" },
  { value: 0.5, label: "Low" },
  { value: 1, label: "Standard" },
  { value: 1.5, label: "High" },
  { value: 2.5, label: "Severe" },
]

export function defaultParamWeights() {
  return { ...DEFAULT_WEIGHTS }
}

export function loadParamWeights() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_WEIGHTS }
  }
  try {
    const raw = localStorage.getItem(WEIGHT_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEIGHTS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || !parsed) return { ...DEFAULT_WEIGHTS }
    const next = { ...DEFAULT_WEIGHTS }
    for (const p of PARAMS) {
      const v = parsed[p.id]
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        next[p.id] = v
      }
    }
    return next
  } catch {
    return { ...DEFAULT_WEIGHTS }
  }
}

export function saveParamWeights(weights) {
  if (typeof window === "undefined") return
  localStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(weights))
}

export function loadParamFlags() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FLAGS }
  }
  try {
    const raw = localStorage.getItem(PARAM_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FLAGS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || !parsed) return { ...DEFAULT_FLAGS }
    return { ...DEFAULT_FLAGS, ...parsed }
  } catch {
    return { ...DEFAULT_FLAGS }
  }
}

export function saveParamFlags(flags) {
  if (typeof window === "undefined") return
  localStorage.setItem(PARAM_STORAGE_KEY, JSON.stringify(flags))
}

export function hasAnyParamEnabled(flags) {
  return Object.values(flags).some(Boolean)
}

function normalizeLocation(input) {
  if (typeof input !== "object" || !input) return { ...DEFAULT_LOCATION }
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ...DEFAULT_LOCATION }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ...DEFAULT_LOCATION }
  }
  const source =
    input.source === "geolocation" || input.source === "zip"
      ? input.source
      : "default"
  const label = typeof input.label === "string" ? input.label.trim() : ""
  const zip = typeof input.zip === "string" ? input.zip.trim() : ""
  return {
    source,
    latitude,
    longitude,
    label: label || DEFAULT_LOCATION.label,
    zip,
  }
}

export function loadLocationPreference() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LOCATION }
  }
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LOCATION }
    const parsed = JSON.parse(raw)
    return normalizeLocation(parsed)
  } catch {
    return { ...DEFAULT_LOCATION }
  }
}

export function saveLocationPreference(location) {
  if (typeof window === "undefined") return
  const normalized = normalizeLocation(location)
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(normalized))
}

export function locationDisplayName(location) {
  const normalized = normalizeLocation(location)
  if (normalized.source === "zip" && normalized.zip) return `ZIP ${normalized.zip}`
  if (normalized.source === "geolocation") return normalized.label || "Current location"
  return normalized.label || "Berlin area"
}
