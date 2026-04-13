import { DEFAULT_FLAGS, PARAMS, weightAxesForParam } from "@/lib/paramConfig"

export const PARAM_STORAGE_KEY = "weather-included-params"
export const WEIGHT_STORAGE_KEY = "weather-param-weights"
export const LOCATION_STORAGE_KEY = "weather-location"

export const ACTIVE_PROFILE_STORAGE_KEY = "weather-active-profile"
export const PROFILE_MIGRATION_MARKER_KEY = "weather-profile-migration-v1"
export const PROFILE_READOUT_LOADED_KEY = "weather-readout-was-loaded"
export const PROFILE_READOUT_REFRESH_KEY = "weather-readout-needs-refresh"

export const PROFILE_IDS = ["me", "wife"]

export const PROFILE_METADATA = {
  me: { id: "me", label: "1" },
  wife: { id: "wife", label: "2" },
}

export const DEFAULT_LOCATION = {
  source: "default",
  latitude: 52.52,
  longitude: 13.41,
  label: "Berlin area",
  zip: "",
}

function paramKeyForProfile(profileId) {
  return `${PARAM_STORAGE_KEY}:${profileId}`
}

function weightKeyForProfile(profileId) {
  return `${WEIGHT_STORAGE_KEY}:${profileId}`
}

function locationKeyForProfile(profileId) {
  return `${LOCATION_STORAGE_KEY}:${profileId}`
}

let migrationRan = false

function runProfileMigrationOnce() {
  if (typeof window === "undefined" || migrationRan) return
  migrationRan = true
  try {
    if (localStorage.getItem(PROFILE_MIGRATION_MARKER_KEY) === "1") return

    const legacyParam = localStorage.getItem(PARAM_STORAGE_KEY)
    const legacyWeight = localStorage.getItem(WEIGHT_STORAGE_KEY)
    const legacyLocation = localStorage.getItem(LOCATION_STORAGE_KEY)
    const hasLegacy =
      legacyParam !== null || legacyWeight !== null || legacyLocation !== null

    if (hasLegacy) {
      if (legacyParam !== null) {
        localStorage.setItem(paramKeyForProfile("me"), legacyParam)
      }
      if (legacyWeight !== null) {
        localStorage.setItem(weightKeyForProfile("me"), legacyWeight)
      }
      if (legacyLocation !== null) {
        localStorage.setItem(locationKeyForProfile("me"), legacyLocation)
      }
      localStorage.removeItem(PARAM_STORAGE_KEY)
      localStorage.removeItem(WEIGHT_STORAGE_KEY)
      localStorage.removeItem(LOCATION_STORAGE_KEY)

      const wifeFlags = { ...DEFAULT_FLAGS }
      localStorage.setItem(paramKeyForProfile("wife"), JSON.stringify(wifeFlags))
      const wifeWeights = defaultParamWeights()
      localStorage.setItem(weightKeyForProfile("wife"), JSON.stringify(wifeWeights))
      const wifeLoc = normalizeLocation(DEFAULT_LOCATION)
      localStorage.setItem(locationKeyForProfile("wife"), JSON.stringify(wifeLoc))

      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, "me")
    } else if (!localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)) {
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, "me")
    }

    localStorage.setItem(PROFILE_MIGRATION_MARKER_KEY, "1")
  } catch {
    migrationRan = false
  }
}

function normalizeProfileId(profileId) {
  if (profileId === "wife" || profileId === "me") return profileId
  return "me"
}

export function getActiveProfileId() {
  if (typeof window === "undefined") return "me"
  runProfileMigrationOnce()
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
    return normalizeProfileId(raw)
  } catch {
    return "me"
  }
}

export function setActiveProfileId(nextId) {
  if (typeof window === "undefined") return
  runProfileMigrationOnce()
  const normalized = normalizeProfileId(nextId)
  try {
    const prev = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, normalized)
    if (prev !== null && prev !== normalized) {
      try {
        sessionStorage.setItem(PROFILE_READOUT_REFRESH_KEY, "1")
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent("weather-active-profile-changed", {
            detail: { profileId: normalized },
          }),
        )
      } catch {}
    }
  } catch {}
}

export function markWeatherReadoutLoaded() {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(PROFILE_READOUT_LOADED_KEY, "1")
  } catch {}
}

export function takeReadoutAutoRefreshIfNeeded() {
  if (typeof window === "undefined") return false
  try {
    if (sessionStorage.getItem(PROFILE_READOUT_REFRESH_KEY) !== "1") return false
    if (sessionStorage.getItem(PROFILE_READOUT_LOADED_KEY) !== "1") return false
    sessionStorage.removeItem(PROFILE_READOUT_REFRESH_KEY)
    return true
  } catch {
    return false
  }
}

function defaultWeightEntryForParam(id) {
  const axes = weightAxesForParam(id)
  return Object.fromEntries(axes.map((axis) => [axis.key, 1]))
}

export const WEIGHT_LEVEL_OPTIONS = [
  { value: 0, label: "Ignore" },
  { value: 0.5, label: "Low" },
  { value: 1, label: "Standard" },
  { value: 1.5, label: "High" },
  { value: 2.5, label: "Severe" },
]

export function defaultParamWeights() {
  return Object.fromEntries(PARAMS.map((p) => [p.id, defaultWeightEntryForParam(p.id)]))
}

function normalizeParamWeightEntry(id, input) {
  const axes = weightAxesForParam(id)
  const next = defaultWeightEntryForParam(id)
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    const value = Math.max(0, input)
    for (const axis of axes) next[axis.key] = value
    return next
  }
  if (typeof input !== "object" || !input) return next
  const asObject = input
  for (const axis of axes) {
    const raw = asObject[axis.key]
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      next[axis.key] = Math.max(0, raw)
      continue
    }
    if (axis.key !== "base") {
      const baseRaw = asObject.base
      if (typeof baseRaw === "number" && Number.isFinite(baseRaw) && baseRaw >= 0) {
        next[axis.key] = Math.max(0, baseRaw)
      }
    }
  }
  return next
}

export function loadParamWeights(profileId) {
  if (typeof window === "undefined") {
    return defaultParamWeights()
  }
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  try {
    const raw = localStorage.getItem(weightKeyForProfile(id))
    if (!raw) return defaultParamWeights()
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || !parsed) return defaultParamWeights()
    const next = defaultParamWeights()
    for (const p of PARAMS) {
      next[p.id] = normalizeParamWeightEntry(p.id, parsed[p.id])
    }
    return next
  } catch {
    return defaultParamWeights()
  }
}

export function saveParamWeights(weights, profileId) {
  if (typeof window === "undefined") return
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  const next = defaultParamWeights()
  if (typeof weights === "object" && weights) {
    for (const p of PARAMS) {
      next[p.id] = normalizeParamWeightEntry(p.id, weights[p.id])
    }
  }
  localStorage.setItem(weightKeyForProfile(id), JSON.stringify(next))
}

export function loadParamFlags(profileId) {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FLAGS }
  }
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  try {
    const raw = localStorage.getItem(paramKeyForProfile(id))
    if (!raw) return { ...DEFAULT_FLAGS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || !parsed) return { ...DEFAULT_FLAGS }
    return { ...DEFAULT_FLAGS, ...parsed }
  } catch {
    return { ...DEFAULT_FLAGS }
  }
}

export function saveParamFlags(flags, profileId) {
  if (typeof window === "undefined") return
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  localStorage.setItem(paramKeyForProfile(id), JSON.stringify(flags))
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

export function loadLocationPreference(profileId) {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LOCATION }
  }
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  try {
    const raw = localStorage.getItem(locationKeyForProfile(id))
    if (!raw) return { ...DEFAULT_LOCATION }
    const parsed = JSON.parse(raw)
    return normalizeLocation(parsed)
  } catch {
    return { ...DEFAULT_LOCATION }
  }
}

export function saveLocationPreference(location, profileId) {
  if (typeof window === "undefined") return
  runProfileMigrationOnce()
  const id = profileId !== undefined ? normalizeProfileId(profileId) : getActiveProfileId()
  const normalized = normalizeLocation(location)
  localStorage.setItem(locationKeyForProfile(id), JSON.stringify(normalized))
}

export function locationDisplayName(location) {
  const normalized = normalizeLocation(location)
  if (normalized.source === "zip" && normalized.zip) return `ZIP ${normalized.zip}`
  if (normalized.source === "geolocation") return normalized.label || "Current location"
  return normalized.label || "Berlin area"
}
