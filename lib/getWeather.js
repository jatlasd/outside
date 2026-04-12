import {
  buildAirHourlyParamList,
  buildForecastHourlyParamList,
  needsAirQualityFetch,
  needsForecastFetch,
} from "@/lib/paramConfig"
import { DEFAULT_LOCATION } from "@/lib/paramPreferences"

function resolveCoordinates(location) {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude }
  }
  return {
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
  }
}

export async function getWeather(flags, location = DEFAULT_LOCATION) {
  const forecastVars = buildForecastHourlyParamList(flags)
  const airVars = buildAirHourlyParamList(flags)
  const tz = "timezone=auto"
  const { latitude, longitude } = resolveCoordinates(location)

  let forecast = null
  let air = null

  if (needsForecastFetch(flags) && forecastVars) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${forecastVars}&${tz}`,
    )
    if (!response.ok) throw new Error("Weather request failed")
    forecast = await response.json()
    if (forecast?.error) {
      throw new Error(forecast.reason || "Weather request failed")
    }
  }

  if (needsAirQualityFetch(flags) && airVars) {
    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=${airVars}&${tz}`,
    )
    if (!response.ok) throw new Error("Air quality request failed")
    air = await response.json()
    if (air?.error) {
      throw new Error(air.reason || "Air quality request failed")
    }
  }

  const timezone = forecast?.timezone ?? air?.timezone ?? "UTC"
  return { forecast, air, timezone }
}
