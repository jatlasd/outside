const POLLEN_API_KEYS = [
  "grass_pollen",
  "birch_pollen",
  "alder_pollen",
  "ragweed_pollen",
  "mugwort_pollen",
  "olive_pollen",
];

function indexMap(timeArr) {
  const m = Object.create(null);
  if (!timeArr) return m;
  for (let i = 0; i < timeArr.length; i++) m[timeArr[i]] = i;
  return m;
}

function maxPollenAt(aq, i) {
  if (i < 0 || !aq) return null;
  let max = null;
  for (const key of POLLEN_API_KEYS) {
    const arr = aq[key];
    if (!arr || i >= arr.length) continue;
    const v = arr[i];
    if (v != null && Number.isFinite(v) && (max == null || v > max)) max = v;
  }
  return max;
}

export function normalizeHourly(forecast, air, flags) {
  const fc = forecast?.hourly;
  const aq = air?.hourly;
  const times = fc?.time?.length ? fc.time : aq?.time?.length ? aq.time : null;
  if (!times?.length) return [];

  const fcMap = indexMap(fc?.time);
  const aqMap = indexMap(aq?.time);

  return times.map((time) => {
    const row = { time };
    const fi = fcMap[time];
    const ai = aqMap[time];
    const getFc = (key) => (fi != null && fc?.[key] ? fc[key][fi] ?? null : null);
    const getAq = (key) => (ai != null && aq?.[key] ? aq[key][ai] ?? null : null);

    if (flags.temperature) row.temperatureC = getFc("temperature_2m");
    if (flags.apparentTemperature) row.apparentTempC = getFc("apparent_temperature");
    if (flags.humidity) row.humidityPct = getFc("relative_humidity_2m");
    if (flags.dewpoint) row.dewpointC = getFc("dew_point_2m");
    if (flags.precipitation) row.rainMm = getFc("rain");
    if (flags.precipitationProbability) row.precipProbabilityPct = getFc("precipitation_probability");
    if (flags.pressure) row.pressureHpa = getFc("pressure_msl");
    if (flags.weatherCode) row.weatherCode = getFc("weather_code");
    if (flags.cloudCover) row.cloudCoverPct = getFc("cloud_cover");
    if (flags.wind) row.windSpeedKmh = getFc("wind_speed_10m");
    if (flags.windGusts) row.windGustsKmh = getFc("wind_gusts_10m");
    if (flags.visibility) row.visibilityM = getFc("visibility");
    if (flags.uv) row.uvIndex = getFc("uv_index");
    if (flags.aqi) row.europeanAqi = getAq("european_aqi");
    if (flags.particulates) {
      row.pm25 = getAq("pm2_5");
      row.pm10 = getAq("pm10");
    }
    if (flags.ozone) row.ozone = getAq("ozone");
    if (flags.carbonMonoxide) row.carbonMonoxide = getAq("carbon_monoxide");
    if (flags.nitrogenDioxide) row.nitrogenDioxide = getAq("nitrogen_dioxide");
    if (flags.pollen && ai != null) row.pollenMax = maxPollenAt(aq, ai);
    return row;
  });
}

export function todayDatePrefixInTimeZone(ianaTimeZone) {
  const tz = ianaTimeZone || "UTC";
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
}

export function currentHourPrefixInTimeZone(ianaTimeZone) {
  const tz = ianaTimeZone || "UTC";
  const d = new Date();
  try {
    const ymd = d.toLocaleDateString("en-CA", { timeZone: tz });
    let [hour] = d.toLocaleTimeString("en-GB", { timeZone: tz }).split(":");
    if (hour === "24") hour = "00";
    return `${ymd}T${hour}:00`;
  } catch {
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "UTC" });
    let [hour] = d.toLocaleTimeString("en-GB", { timeZone: "UTC" }).split(":");
    if (hour === "24") hour = "00";
    return `${ymd}T${hour}:00`;
  }
}

export function filterHoursByDatePrefix(hours, datePrefix) {
  if (!datePrefix) return hours;
  return hours.filter((h) => h.time.startsWith(datePrefix));
}
