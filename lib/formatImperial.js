import { PARAM_REFERENCE } from "@/lib/paramConfig"

export function cToF(c) {
  if (c == null || !Number.isFinite(c)) return null
  return (c * 9) / 5 + 32
}

export function kmhToMph(kmh) {
  if (kmh == null || !Number.isFinite(kmh)) return null
  return kmh * 0.621371
}

export function metersToMiles(m) {
  if (m == null || !Number.isFinite(m)) return null
  return m / 1609.344
}

export function mmToInches(mm) {
  if (mm == null || !Number.isFinite(mm)) return null
  return mm / 25.4
}

export function fmtTempF(c, decimals = 0) {
  const f = cToF(c)
  if (f == null) return "—"
  return `${f.toFixed(decimals)} °F`
}

export function fmtWindMph(kmh, decimals = 0) {
  const mph = kmhToMph(kmh)
  if (mph == null) return "—"
  return `${mph.toFixed(decimals)} mph`
}

export function fmtMiles(meters, decimals = 2) {
  const mi = metersToMiles(meters)
  if (mi == null) return "—"
  if (mi < 0.1 && mi > 0) return `${mi.toFixed(decimals)} mi`
  return `${mi.toFixed(decimals)} mi`
}

export function fmtInchesRain(mm, decimals = 2) {
  const inches = mmToInches(mm)
  if (inches == null) return "—"
  return `${inches.toFixed(decimals)} in`
}

export function fmtInt(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return String(Math.round(v))
}

export function fmtFixed(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return v.toFixed(d)
}

export function hourReadoutEntries(row, flags, options = {}) {
  const out = []
  const offenderById =
    options.offenderById instanceof Map ? options.offenderById : null

  const pushEntry = (id, term, desc) => {
    const ref = PARAM_REFERENCE[id] ?? {}
    const offender = offenderById?.get(id) ?? null
    out.push({
      id,
      term,
      desc,
      blurb: ref.blurb ?? "",
      referenceRange: ref.referenceRange ?? "",
      flaggedWhen: ref.flaggedWhen ?? "",
      isOffender: Boolean(offender),
      offenderPct: offender?.pct ?? 0,
    })
  }

  if (flags.temperature) pushEntry("temperature", "Temperature", fmtTempF(row.temperatureC))
  if (flags.apparentTemperature)
    pushEntry("apparentTemperature", "Feels like", fmtTempF(row.apparentTempC))
  if (flags.humidity) pushEntry("humidity", "Humidity", `${fmtInt(row.humidityPct)}%`)
  if (flags.dewpoint) pushEntry("dewpoint", "Dew point", fmtTempF(row.dewpointC))
  if (flags.precipitation)
    pushEntry("precipitation", "Rain (hour)", fmtInchesRain(row.rainMm))
  if (flags.precipitationProbability)
    pushEntry(
      "precipitationProbability",
      "Precip chance",
      `${fmtInt(row.precipProbabilityPct)}%`,
    )
  if (flags.pressure)
    pushEntry("pressure", "Pressure", `${fmtInt(row.pressureHpa)} hPa`)
  if (flags.weatherCode)
    pushEntry("weatherCode", "Weather code", fmtInt(row.weatherCode))
  if (flags.cloudCover)
    pushEntry("cloudCover", "Cloud cover", `${fmtInt(row.cloudCoverPct)}%`)
  if (flags.wind) pushEntry("wind", "Wind", fmtWindMph(row.windSpeedKmh))
  if (flags.windGusts)
    pushEntry("windGusts", "Wind gusts", fmtWindMph(row.windGustsKmh))
  if (flags.visibility) pushEntry("visibility", "Visibility", fmtMiles(row.visibilityM))
  if (flags.uv) pushEntry("uv", "UV index", fmtFixed(row.uvIndex, 1))
  if (flags.aqi) pushEntry("aqi", "European AQI", fmtInt(row.europeanAqi))
  if (flags.particulates)
    pushEntry(
      "particulates",
      "PM2.5 / PM10",
      `${fmtFixed(row.pm25, 1)} / ${fmtFixed(row.pm10, 1)} µg/m³`,
    )
  if (flags.ozone) pushEntry("ozone", "Ozone", `${fmtInt(row.ozone)} µg/m³`)
  if (flags.carbonMonoxide)
    pushEntry("carbonMonoxide", "CO", `${fmtInt(row.carbonMonoxide)} µg/m³`)
  if (flags.nitrogenDioxide)
    pushEntry("nitrogenDioxide", "NO₂", `${fmtInt(row.nitrogenDioxide)} µg/m³`)
  if (flags.pollen) pushEntry("pollen", "Pollen (peak)", fmtInt(row.pollenMax))
  return out
}
