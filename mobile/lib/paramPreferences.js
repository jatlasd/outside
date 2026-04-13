import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_FLAGS, PARAMS, weightAxesForParam } from "./paramConfig";

export const PARAM_STORAGE_KEY = "weather-included-params";
export const WEIGHT_STORAGE_KEY = "weather-param-weights";
export const LOCATION_STORAGE_KEY = "weather-location";

export const PROFILE_IDS = ["me", "wife"];
export const DEFAULT_PROFILE_ID = "me";
export const ACTIVE_PROFILE_STORAGE_KEY = "weather-active-profile";
export const PROFILE_MIGRATION_KEY = "weather-profile-migration-v1";

export const PROFILE_METADATA = {
  me: { label: "1" },
  wife: { label: "2" },
};

export const DEFAULT_LOCATION = {
  source: "default",
  latitude: 52.52,
  longitude: 13.41,
  label: "Berlin area",
  zip: "",
};

let profileMigrationPromise = null;

function namespacedParamsKey(profileId) {
  return `${PARAM_STORAGE_KEY}:${profileId}`;
}

function namespacedWeightsKey(profileId) {
  return `${WEIGHT_STORAGE_KEY}:${profileId}`;
}

function namespacedLocationKey(profileId) {
  return `${LOCATION_STORAGE_KEY}:${profileId}`;
}

function normalizeProfileId(profileId) {
  return profileId === "wife" ? "wife" : "me";
}

async function ensureProfileMigration() {
  if (!profileMigrationPromise) {
    profileMigrationPromise = (async () => {
      const done = await AsyncStorage.getItem(PROFILE_MIGRATION_KEY);
      if (done === "1") return;
      const legacyParam = await AsyncStorage.getItem(PARAM_STORAGE_KEY);
      const legacyWeight = await AsyncStorage.getItem(WEIGHT_STORAGE_KEY);
      const legacyLoc = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      const hasLegacy =
        legacyParam != null || legacyWeight != null || legacyLoc != null;
      if (hasLegacy) {
        const tasks = [];
        if (legacyParam != null) {
          tasks.push(AsyncStorage.setItem(namespacedParamsKey("me"), legacyParam));
        }
        if (legacyWeight != null) {
          tasks.push(AsyncStorage.setItem(namespacedWeightsKey("me"), legacyWeight));
        }
        if (legacyLoc != null) {
          tasks.push(AsyncStorage.setItem(namespacedLocationKey("me"), legacyLoc));
        }
        await Promise.all(tasks);
        const wifeLoc = normalizeLocation(DEFAULT_LOCATION);
        await AsyncStorage.setItem(
          namespacedParamsKey("wife"),
          JSON.stringify({ ...DEFAULT_FLAGS })
        );
        await AsyncStorage.setItem(
          namespacedWeightsKey("wife"),
          JSON.stringify(defaultParamWeights())
        );
        await AsyncStorage.setItem(
          namespacedLocationKey("wife"),
          JSON.stringify(wifeLoc)
        );
        await AsyncStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, "me");
        await AsyncStorage.multiRemove([
          PARAM_STORAGE_KEY,
          WEIGHT_STORAGE_KEY,
          LOCATION_STORAGE_KEY,
        ]);
      } else {
        const existingActive = await AsyncStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
        if (existingActive !== "me" && existingActive !== "wife") {
          await AsyncStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, DEFAULT_PROFILE_ID);
        }
      }
      await AsyncStorage.setItem(PROFILE_MIGRATION_KEY, "1");
    })();
  }
  await profileMigrationPromise;
}

export async function getActiveProfile() {
  await ensureProfileMigration();
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (raw === "me" || raw === "wife") return raw;
    return DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

export async function setActiveProfile(profileId) {
  await ensureProfileMigration();
  const id = normalizeProfileId(profileId);
  await AsyncStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
}

function defaultWeightEntryForParam(id) {
  const axes = weightAxesForParam(id);
  return Object.fromEntries(axes.map((axis) => [axis.key, 1]));
}

export const WEIGHT_LEVEL_OPTIONS = [
  { value: 0, label: "Ignore" },
  { value: 0.5, label: "Low" },
  { value: 1, label: "Standard" },
  { value: 1.5, label: "High" },
  { value: 2.5, label: "Severe" },
];

export function defaultParamWeights() {
  return Object.fromEntries(PARAMS.map((p) => [p.id, defaultWeightEntryForParam(p.id)]));
}

function normalizeParamWeightEntry(id, input) {
  const axes = weightAxesForParam(id);
  const next = defaultWeightEntryForParam(id);
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    const value = Math.max(0, input);
    for (const axis of axes) next[axis.key] = value;
    return next;
  }
  if (typeof input !== "object" || !input) return next;
  const asObject = input;
  for (const axis of axes) {
    const raw = asObject[axis.key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      next[axis.key] = Math.max(0, raw);
      continue;
    }
    if (axis.key !== "base") {
      const baseRaw = asObject.base;
      if (typeof baseRaw === "number" && Number.isFinite(baseRaw) && baseRaw >= 0) {
        next[axis.key] = Math.max(0, baseRaw);
      }
    }
  }
  return next;
}

export async function loadParamWeights(profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  try {
    const raw = await AsyncStorage.getItem(namespacedWeightsKey(id));
    if (!raw) return defaultParamWeights();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return defaultParamWeights();
    const next = defaultParamWeights();
    for (const p of PARAMS) {
      next[p.id] = normalizeParamWeightEntry(p.id, parsed[p.id]);
    }
    return next;
  } catch {
    return defaultParamWeights();
  }
}

export async function saveParamWeights(weights, profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  const next = defaultParamWeights();
  if (typeof weights === "object" && weights) {
    for (const p of PARAMS) {
      next[p.id] = normalizeParamWeightEntry(p.id, weights[p.id]);
    }
  }
  await AsyncStorage.setItem(namespacedWeightsKey(id), JSON.stringify(next));
}

export async function loadParamFlags(profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  try {
    const raw = await AsyncStorage.getItem(namespacedParamsKey(id));
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return { ...DEFAULT_FLAGS };
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export async function saveParamFlags(flags, profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  await AsyncStorage.setItem(namespacedParamsKey(id), JSON.stringify(flags));
}

export function hasAnyParamEnabled(flags) {
  return Object.values(flags).some(Boolean);
}

function normalizeLocation(input) {
  if (typeof input !== "object" || !input) return { ...DEFAULT_LOCATION };
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ...DEFAULT_LOCATION };
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return { ...DEFAULT_LOCATION };
  const source = input.source === "geolocation" || input.source === "zip" ? input.source : "default";
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const zip = typeof input.zip === "string" ? input.zip.trim() : "";
  return { source, latitude, longitude, label: label || DEFAULT_LOCATION.label, zip };
}

export async function loadLocationPreference(profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  try {
    const raw = await AsyncStorage.getItem(namespacedLocationKey(id));
    if (!raw) return { ...DEFAULT_LOCATION };
    const parsed = JSON.parse(raw);
    return normalizeLocation(parsed);
  } catch {
    return { ...DEFAULT_LOCATION };
  }
}

export async function saveLocationPreference(location, profileId) {
  await ensureProfileMigration();
  const id = profileId != null ? normalizeProfileId(profileId) : await getActiveProfile();
  const normalized = normalizeLocation(location);
  await AsyncStorage.setItem(namespacedLocationKey(id), JSON.stringify(normalized));
}

export function locationDisplayName(location) {
  const normalized = normalizeLocation(location);
  if (normalized.source === "zip" && normalized.zip) return `ZIP ${normalized.zip}`;
  if (normalized.source === "geolocation") return normalized.label || "Current location";
  return normalized.label || "Berlin area";
}
