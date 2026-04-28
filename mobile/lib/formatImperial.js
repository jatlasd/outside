import { PARAM_REFERENCE } from "./paramConfig"

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
  const compareYesterday =
    options.compareYesterday instanceof Map ? options.compareYesterday : null

  const pushEntry = (id, term, desc) => {
    const ref = PARAM_REFERENCE[id] ?? {}
    const offender = offenderById?.get(id) ?? null
    const yesterdayLine = compareYesterday?.get(id) ?? null
    out.push({
      id,
      term,
      desc,
      blurb: ref.blurb ?? "",
      referenceRange: ref.referenceRange ?? "",
      flaggedWhen: ref.flaggedWhen ?? "",
      isOffender: Boolean(offender),
      offenderPct: offender?.pct ?? 0,
      yesterdayLine,
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

function diffFahrenheit(cToday, cYesterday) {
  if (cToday == null || cYesterday == null) return null
  if (!Number.isFinite(cToday) || !Number.isFinite(cYesterday)) return null
  return cToF(cToday) - cToF(cYesterday)
}

function signedNumber(n, decimals = 0) {
  if (n == null || !Number.isFinite(n)) return null
  if (n === 0) return "0"
  const sign = n > 0 ? "+" : ""
  const abs = Math.abs(n)
  const body =
    decimals === 0 ? String(Math.round(abs)) : abs.toFixed(decimals)
  return n < 0 ? `−${body}` : `${sign}${body}`
}

function deltaVsPhrase(delta, decimals, unitSuffix) {
  if (delta == null || !Number.isFinite(delta)) return null
  if (delta === 0) return "same as this hour"
  const s = signedNumber(delta, decimals)
  if (!s) return null
  return `${s}${unitSuffix} vs this hour`
}

export function yesterdayComparisonLine(id, todayRow, yesterdayRow, priorDayLabel = "Yesterday") {
  if (!todayRow || !yesterdayRow) return null
  const y = yesterdayRow
  const t = todayRow
  const L = priorDayLabel || "Yesterday"

  if (id === "temperature") {
    const d = diffFahrenheit(t.temperatureC, y.temperatureC)
    if (d == null) return null
    const yDesc = fmtTempF(y.temperatureC)
    const phrase = deltaVsPhrase(d, 0, " °F")
    if (!phrase) return null
    return `${L}: ${yDesc} (${phrase})`
  }
  if (id === "apparentTemperature") {
    const d = diffFahrenheit(t.apparentTempC, y.apparentTempC)
    if (d == null) return null
    const yDesc = fmtTempF(y.apparentTempC)
    const phrase = deltaVsPhrase(d, 0, " °F")
    if (!phrase) return null
    return `${L}: ${yDesc} (${phrase})`
  }
  if (id === "humidity") {
    if (y.humidityPct == null || t.humidityPct == null) return null
    if (!Number.isFinite(y.humidityPct) || !Number.isFinite(t.humidityPct)) return null
    const d = t.humidityPct - y.humidityPct
    const phrase = deltaVsPhrase(d, 0, "%")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.humidityPct)}% (${phrase})`
  }
  if (id === "dewpoint") {
    const d = diffFahrenheit(t.dewpointC, y.dewpointC)
    if (d == null) return null
    const yDesc = fmtTempF(y.dewpointC)
    const phrase = deltaVsPhrase(d, 0, " °F")
    if (!phrase) return null
    return `${L}: ${yDesc} (${phrase})`
  }
  if (id === "precipitation") {
    if (y.rainMm == null || t.rainMm == null) return null
    if (!Number.isFinite(y.rainMm) || !Number.isFinite(t.rainMm)) return null
    const dIn = mmToInches(t.rainMm - y.rainMm)
    if (dIn == null) return null
    const phrase = deltaVsPhrase(dIn, 2, " in")
    if (!phrase) return null
    return `${L}: ${fmtInchesRain(y.rainMm)} (${phrase})`
  }
  if (id === "precipitationProbability") {
    if (y.precipProbabilityPct == null || t.precipProbabilityPct == null) return null
    if (!Number.isFinite(y.precipProbabilityPct) || !Number.isFinite(t.precipProbabilityPct)) return null
    const d = t.precipProbabilityPct - y.precipProbabilityPct
    const phrase = deltaVsPhrase(d, 0, "%")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.precipProbabilityPct)}% (${phrase})`
  }
  if (id === "pressure") {
    if (y.pressureHpa == null || t.pressureHpa == null) return null
    if (!Number.isFinite(y.pressureHpa) || !Number.isFinite(t.pressureHpa)) return null
    const d = t.pressureHpa - y.pressureHpa
    const phrase = deltaVsPhrase(d, 0, " hPa")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.pressureHpa)} hPa (${phrase})`
  }
  if (id === "weatherCode") {
    if (y.weatherCode == null || t.weatherCode == null) return null
    if (!Number.isFinite(y.weatherCode) || !Number.isFinite(t.weatherCode)) return null
    if (Math.trunc(y.weatherCode) === Math.trunc(t.weatherCode)) return null
    return `${L} code ${fmtInt(y.weatherCode)} (this day ${fmtInt(t.weatherCode)})`
  }
  if (id === "cloudCover") {
    if (y.cloudCoverPct == null || t.cloudCoverPct == null) return null
    if (!Number.isFinite(y.cloudCoverPct) || !Number.isFinite(t.cloudCoverPct)) return null
    const d = t.cloudCoverPct - y.cloudCoverPct
    const phrase = deltaVsPhrase(d, 0, "%")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.cloudCoverPct)}% (${phrase})`
  }
  if (id === "wind") {
    const dMph = kmhToMph(t.windSpeedKmh) - kmhToMph(y.windSpeedKmh)
    if (dMph == null || !Number.isFinite(dMph)) return null
    const phrase = deltaVsPhrase(dMph, 0, " mph")
    if (!phrase) return null
    return `${L}: ${fmtWindMph(y.windSpeedKmh)} (${phrase})`
  }
  if (id === "windGusts") {
    const dMph = kmhToMph(t.windGustsKmh) - kmhToMph(y.windGustsKmh)
    if (dMph == null || !Number.isFinite(dMph)) return null
    const phrase = deltaVsPhrase(dMph, 0, " mph")
    if (!phrase) return null
    return `${L}: ${fmtWindMph(y.windGustsKmh)} (${phrase})`
  }
  if (id === "visibility") {
    const dMi = metersToMiles(t.visibilityM) - metersToMiles(y.visibilityM)
    if (dMi == null || !Number.isFinite(dMi)) return null
    const phrase = deltaVsPhrase(dMi, 1, " mi")
    if (!phrase) return null
    return `${L}: ${fmtMiles(y.visibilityM)} (${phrase})`
  }
  if (id === "uv") {
    if (y.uvIndex == null || t.uvIndex == null) return null
    if (!Number.isFinite(y.uvIndex) || !Number.isFinite(t.uvIndex)) return null
    const d = t.uvIndex - y.uvIndex
    const phrase = deltaVsPhrase(d, 1, "")
    if (!phrase) return null
    return `${L}: ${fmtFixed(y.uvIndex, 1)} (${phrase})`
  }
  if (id === "aqi") {
    if (y.europeanAqi == null || t.europeanAqi == null) return null
    if (!Number.isFinite(y.europeanAqi) || !Number.isFinite(t.europeanAqi)) return null
    const d = t.europeanAqi - y.europeanAqi
    const phrase = deltaVsPhrase(d, 0, "")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.europeanAqi)} (${phrase})`
  }
  if (id === "particulates") {
    if (
      y.pm25 == null ||
      t.pm25 == null ||
      y.pm10 == null ||
      t.pm10 == null
    )
      return null
    if (
      !Number.isFinite(y.pm25) ||
      !Number.isFinite(t.pm25) ||
      !Number.isFinite(y.pm10) ||
      !Number.isFinite(t.pm10)
    )
      return null
    const d25 = t.pm25 - y.pm25
    const d10 = t.pm10 - y.pm10
    const p25 = deltaVsPhrase(d25, 1, " µg/m³")
    const p10 = deltaVsPhrase(d10, 1, " µg/m³")
    if (!p25 || !p10) return null
    return `${L}: ${fmtFixed(y.pm25, 1)} / ${fmtFixed(y.pm10, 1)} µg/m³ (PM2.5 ${p25}; PM10 ${p10})`
  }
  if (id === "ozone") {
    if (y.ozone == null || t.ozone == null) return null
    if (!Number.isFinite(y.ozone) || !Number.isFinite(t.ozone)) return null
    const d = t.ozone - y.ozone
    const phrase = deltaVsPhrase(d, 0, " µg/m³")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.ozone)} µg/m³ (${phrase})`
  }
  if (id === "carbonMonoxide") {
    if (y.carbonMonoxide == null || t.carbonMonoxide == null) return null
    if (!Number.isFinite(y.carbonMonoxide) || !Number.isFinite(t.carbonMonoxide)) return null
    const d = t.carbonMonoxide - y.carbonMonoxide
    const phrase = deltaVsPhrase(d, 0, " µg/m³")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.carbonMonoxide)} µg/m³ (${phrase})`
  }
  if (id === "nitrogenDioxide") {
    if (y.nitrogenDioxide == null || t.nitrogenDioxide == null) return null
    if (!Number.isFinite(y.nitrogenDioxide) || !Number.isFinite(t.nitrogenDioxide)) return null
    const d = t.nitrogenDioxide - y.nitrogenDioxide
    const phrase = deltaVsPhrase(d, 0, " µg/m³")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.nitrogenDioxide)} µg/m³ (${phrase})`
  }
  if (id === "pollen") {
    if (y.pollenMax == null || t.pollenMax == null) return null
    if (!Number.isFinite(y.pollenMax) || !Number.isFinite(t.pollenMax)) return null
    const d = t.pollenMax - y.pollenMax
    const phrase = deltaVsPhrase(d, 0, "")
    if (!phrase) return null
    return `${L}: ${fmtInt(y.pollenMax)} (${phrase})`
  }
  return null
}
