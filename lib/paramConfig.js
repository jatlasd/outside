export const PARAM_GROUP_LABELS = {
  weather: "Weather",
  air: "Air quality",
  allergens: "Pollen & allergens",
}

export const PARAMS = [
  { id: "temperature", label: "Temperature", group: "weather", source: "forecast", vars: ["temperature_2m"] },
  { id: "apparentTemperature", label: "Feels like temperature", group: "weather", source: "forecast", vars: ["apparent_temperature"] },
  { id: "humidity", label: "Humidity", group: "weather", source: "forecast", vars: ["relative_humidity_2m"] },
  { id: "dewpoint", label: "Dew point", group: "weather", source: "forecast", vars: ["dew_point_2m"] },
  { id: "precipitation", label: "Rain", group: "weather", source: "forecast", vars: ["rain"] },
  { id: "precipitationProbability", label: "Chance of rain", group: "weather", source: "forecast", vars: ["precipitation_probability"] },
  { id: "pressure", label: "Air pressure", group: "weather", source: "forecast", vars: ["pressure_msl"] },
  { id: "weatherCode", label: "Conditions (rain, fog, storms)", group: "weather", source: "forecast", vars: ["weather_code"] },
  { id: "cloudCover", label: "Cloud cover", group: "weather", source: "forecast", vars: ["cloud_cover"] },
  { id: "wind", label: "Wind speed", group: "weather", source: "forecast", vars: ["wind_speed_10m"] },
  { id: "windGusts", label: "Wind gusts", group: "weather", source: "forecast", vars: ["wind_gusts_10m"] },
  { id: "visibility", label: "Visibility", group: "weather", source: "forecast", vars: ["visibility"] },
  { id: "uv", label: "UV index", group: "weather", source: "forecast", vars: ["uv_index"] },
  { id: "aqi", label: "Air quality index (EU)", group: "air", source: "air", vars: ["european_aqi"] },
  { id: "particulates", label: "Particle pollution (PM2.5 + PM10)", group: "air", source: "air", vars: ["pm2_5", "pm10"] },
  { id: "ozone", label: "Ozone", group: "air", source: "air", vars: ["ozone"] },
  { id: "pollen", label: "Pollen level", group: "allergens", source: "air", vars: ["grass_pollen", "birch_pollen", "alder_pollen", "ragweed_pollen", "mugwort_pollen", "olive_pollen"] },
  { id: "carbonMonoxide", label: "Carbon monoxide", group: "air", source: "air", vars: ["carbon_monoxide"] },
  { id: "nitrogenDioxide", label: "Nitrogen dioxide", group: "air", source: "air", vars: ["nitrogen_dioxide"] },
]

export const DEFAULT_WEIGHT_AXES = [
  { key: "base", label: "Sensitivity" },
]

export const PARAM_WEIGHT_AXES = {
  temperature: [
    { key: "hot", label: "Heat sensitivity" },
    { key: "cold", label: "Cold sensitivity" },
  ],
  apparentTemperature: [
    { key: "hot", label: "Feels-like heat sensitivity" },
    { key: "cold", label: "Feels-like cold sensitivity" },
  ],
  humidity: [
    { key: "high", label: "Humidity sensitivity" },
    { key: "low", label: "Dry air sensitivity" },
  ],
  precipitation: [
    { key: "high", label: "Rain sensitivity" },
  ],
  precipitationProbability: [
    { key: "high", label: "Rain chance sensitivity" },
  ],
  cloudCover: [
    { key: "low", label: "Bright sky sensitivity" },
    { key: "high", label: "Overcast sensitivity" },
  ],
  wind: [
    { key: "high", label: "Strong wind sensitivity" },
    { key: "low", label: "Still-air sensitivity" },
  ],
}

export function weightAxesForParam(id) {
  return PARAM_WEIGHT_AXES[id] ?? DEFAULT_WEIGHT_AXES
}

export const PARAM_REFERENCE = {
  temperature: {
    blurb: "Air temperature for this hour.",
    referenceRange: "Stable conditions: less than about 5 \u00B0F (3 \u00B0C) change vs prior hour.",
    flaggedWhen:
      "Scoring rises when hour-over-hour change reaches about 5 \u00B0F (3 \u00B0C) or 9 \u00B0F (5 \u00B0C), or when air is very hot or freezing (see level rules).",
  },
  apparentTemperature: {
    blurb: "How temperature feels on the body.",
    referenceRange: "Typical comfort band about 50\u201386 \u00B0F (10\u201330 \u00B0C).",
    flaggedWhen:
      "Scoring rises on hour-over-hour jumps of about 5 \u00B0F (3 \u00B0C) or 9 \u00B0F (5 \u00B0C), and at extremes (\u2265 about 90 \u00B0F / 32 \u00B0C or \u2264 about 10 \u00B0F / \u221212 \u00B0C). Mild levels damp trend-only heat penalties.",
  },
  humidity: {
    blurb: "Relative humidity in percent.",
    referenceRange: "Typical comfort band: 30% to 60%.",
    flaggedWhen: "Scoring rises at >= 85% and more at >= 90%.",
  },
  dewpoint: {
    blurb: "Moisture level felt as mugginess.",
    referenceRange: "Lower mugginess: dew point below about 68 \u00B0F (20 \u00B0C).",
    flaggedWhen: "Scoring rises at \u2265 about 68 \u00B0F (20 \u00B0C) and more at \u2265 about 75 \u00B0F (24 \u00B0C).",
  },
  precipitation: {
    blurb: "Rain amount expected in this hour.",
    referenceRange: "Lower disruption: under 0.3 mm per hour.",
    flaggedWhen: "Scoring rises at >= 0.3 mm and more at >= 1.0 mm.",
  },
  precipitationProbability: {
    blurb: "Chance of precipitation during this hour.",
    referenceRange: "Lower weather uncertainty: under 70%.",
    flaggedWhen: "Scoring rises at >= 70% and more at >= 85%.",
  },
  pressure: {
    blurb: "Sea-level pressure trend signal.",
    referenceRange: "Steadier profile: less than 3 hPa change vs prior hour.",
    flaggedWhen: "Scoring rises at >= 3 hPa and more at >= 5 hPa hour-over-hour change.",
  },
  weatherCode: {
    blurb: "Condition category from forecast weather code.",
    referenceRange: "Lower-impact categories are clear to light-cloud or light-precip codes.",
    flaggedWhen: "Scoring rises for fog, moderate/heavy rain, snow or ice pellets, and thunderstorms.",
  },
  cloudCover: {
    blurb: "Sky cover percentage.",
    referenceRange: "Middle ranges are usually less intense.",
    flaggedWhen: "Scoring rises near extremes: <= 10% (bright) or >= 92% (very overcast).",
  },
  wind: {
    blurb: "Sustained wind speed.",
    referenceRange: "Lower wind load: below about 25 mph (40 km/h).",
    flaggedWhen: "Scoring rises at \u2265 about 25 mph (40 km/h) and more at \u2265 about 34 mph (55 km/h).",
  },
  windGusts: {
    blurb: "Peak gust speed variability.",
    referenceRange: "Steadier gust profile: less than about 7 mph (12 km/h) change vs prior hour.",
    flaggedWhen: "Scoring rises at \u2265 about 7 mph (12 km/h) and more at \u2265 about 12 mph (20 km/h) hour-over-hour gust change.",
  },
  visibility: {
    blurb: "How far you can see through the air.",
    referenceRange: "Lower visual strain: at least 4,000 m visibility.",
    flaggedWhen: "Scoring rises below 4,000 m and more below 1,000 m.",
  },
  uv: {
    blurb: "UV radiation intensity index.",
    referenceRange: "Lower UV exposure risk: under index 3.",
    flaggedWhen: "Scoring rises at UV >= 3 and more at UV >= 6.",
  },
  aqi: {
    blurb: "European AQI overall air-quality index.",
    referenceRange: "Lower respiratory load: under 40.",
    flaggedWhen: "Scoring rises at AQI >= 40, >= 55, and >= 75.",
  },
  particulates: {
    blurb: "Fine and coarse particle concentration.",
    referenceRange: "Lower particle load: PM2.5 < 15 and PM10 < 50 ug/m3.",
    flaggedWhen: "Scoring rises as PM2.5 crosses 15, 25, 50 and PM10 crosses 50, 100.",
  },
  ozone: {
    blurb: "Ground-level ozone concentration.",
    referenceRange: "Lower ozone stress: under 100 ug/m3.",
    flaggedWhen: "Scoring rises at 100, 120, and 180 ug/m3.",
  },
  pollen: {
    blurb: "Peak mixed-species pollen signal.",
    referenceRange: "Lower allergen pressure: below 15.",
    flaggedWhen: "Scoring rises at 15, 40, and 80.",
  },
  carbonMonoxide: {
    blurb: "Carbon monoxide concentration.",
    referenceRange: "Lower CO signal: under 2,000 ug/m3.",
    flaggedWhen: "Scoring rises at 2,000 and 5,000 ug/m3.",
  },
  nitrogenDioxide: {
    blurb: "Nitrogen dioxide concentration.",
    referenceRange: "Lower NO2 signal: under 80 ug/m3.",
    flaggedWhen: "Scoring rises at 80, 120, and 200 ug/m3.",
  },
}

export const DEFAULT_FLAGS = Object.fromEntries(
  PARAMS.map((p) => [p.id, true]),
)

export function buildForecastHourlyParamList(flags) {
  const set = new Set()
  for (const p of PARAMS) {
    if (p.source === "forecast" && flags[p.id]) {
      for (const v of p.vars) set.add(v)
    }
  }
  return Array.from(set).sort().join(",")
}

export function buildAirHourlyParamList(flags) {
  const set = new Set()
  for (const p of PARAMS) {
    if (p.source === "air" && flags[p.id]) {
      for (const v of p.vars) set.add(v)
    }
  }
  return Array.from(set).sort().join(",")
}

export function needsAirQualityFetch(flags) {
  return PARAMS.some((p) => p.source === "air" && flags[p.id])
}

export function needsForecastFetch(flags) {
  return PARAMS.some((p) => p.source === "forecast" && flags[p.id])
}
