import { PARAMS } from "@/lib/paramConfig"

const BREAKDOWN_TOP_K = 8

function clampScore(n) {
  return Math.min(100, Math.max(0, n))
}

function impactBandFor(score) {
  if (!Number.isFinite(score)) return "unknown"
  if (score <= 25) return "low"
  if (score <= 50) return "moderate"
  if (score <= 75) return "high"
  return "severe"
}

function impactSummaryForBand(band) {
  if (band === "low") return "Outside load is likely light for most activities."
  if (band === "moderate")
    return "Outside conditions may add noticeable strain through parts of the day."
  if (band === "high")
    return "Outside conditions are likely a major contributor for much of today."
  if (band === "severe")
    return "Outside pressure is intense today and may dominate how you feel."
  return "Outside impact is unavailable."
}

function weightFor(weights, id) {
  if (!weights) return 1
  const v = weights[id]
  if (v == null || !Number.isFinite(v)) return 1
  return Math.max(0, v)
}

function bump(breakdown, id, delta) {
  if (!delta || !Number.isFinite(delta)) return
  breakdown[id] = (breakdown[id] ?? 0) + delta
}

function weatherCodePenalty(code) {
  if (code == null || !Number.isFinite(code)) return { score: 0, reason: null }
  const c = Math.trunc(code)
  if (c >= 95)
    return { score: 26, reason: "Thunderstorm conditions (weather code)" }
  if (c >= 71 && c <= 77)
    return { score: 12, reason: "Snow / ice pellets (weather code)" }
  if (c === 45 || c === 48)
    return { score: 10, reason: "Fog (weather code)" }
  if (c >= 82 || c === 65)
    return { score: 10, reason: "Heavy rain or intense showers (weather code)" }
  if (c === 63 || c === 81)
    return { score: 6, reason: "Moderate rain or showers (weather code)" }
  return { score: 0, reason: null }
}

const PARAM_LABEL_BY_ID = Object.fromEntries(
  PARAMS.map((p) => [p.id, p.label]),
)

export function rollupBreakdown(scored) {
  const sums = {}
  for (const row of scored) {
    const bd = row.breakdown
    if (!bd || typeof bd !== "object") continue
    for (const [id, v] of Object.entries(bd)) {
      if (!Number.isFinite(v) || v <= 0) continue
      sums[id] = (sums[id] ?? 0) + v
    }
  }
  const entries = Object.entries(sums)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const totalRaw = entries.reduce((s, [, v]) => s + v, 0)
  if (totalRaw <= 0) return { items: [], totalRaw: 0 }

  const top = entries.slice(0, BREAKDOWN_TOP_K)
  const rest = entries.slice(BREAKDOWN_TOP_K)
  const otherRaw = rest.reduce((acc, [, v]) => acc + v, 0)

  const items = top.map(([id, raw]) => ({
    id,
    label: PARAM_LABEL_BY_ID[id] ?? id,
    raw,
    pct: (100 * raw) / totalRaw,
  }))

  if (otherRaw > 0) {
    items.push({
      id: "__other__",
      label: "Other",
      raw: otherRaw,
      pct: (100 * otherRaw) / totalRaw,
    })
  }

  return { items, totalRaw }
}

export function topBreakdownContributors(breakdown, limit = 2) {
  if (!breakdown || typeof breakdown !== "object") return []
  const entries = Object.entries(breakdown)
    .filter(([, raw]) => Number.isFinite(raw) && raw > 0)
    .sort((a, b) => b[1] - a[1])
  if (!entries.length) return []
  const safeLimit = Math.max(1, Math.trunc(limit))
  const top = entries.slice(0, safeLimit)
  const total = entries.reduce((sum, [, raw]) => sum + raw, 0)
  return top.map(([id, raw]) => ({
    id,
    raw,
    pct: total > 0 ? (100 * raw) / total : 0,
  }))
}

export function scoreHours(hours, flags, weights) {
  return hours.map((hour, i) => {
    let score = 0
    const reasons = []
    const breakdown = {}

    const wt = (id) => weightFor(weights, id)

    if (flags.temperature && wt("temperature") > 0 && i > 0) {
      const w = wt("temperature")
      const prev = hours[i - 1].temperatureC
      const cur = hour.temperatureC
      if (prev != null && cur != null) {
        const delta = Math.abs(cur - prev)
        if (delta >= 5) {
          const add = 32 * w
          score += add
          bump(breakdown, "temperature", add)
          reasons.push("Sharp temperature change vs prior hour")
        } else if (delta >= 3) {
          const add = 16 * w
          score += add
          bump(breakdown, "temperature", add)
          reasons.push("Notable temperature shift")
        }
      }
    }

    if (flags.apparentTemperature && wt("apparentTemperature") > 0) {
      const w = wt("apparentTemperature")
      const ap = hour.apparentTempC
      if (ap != null) {
        if (i > 0) {
          const prev = hours[i - 1].apparentTempC
          if (prev != null) {
            const delta = Math.abs(ap - prev)
            if (delta >= 5) {
              const add = 18 * w
              score += add
              bump(breakdown, "apparentTemperature", add)
              reasons.push("Large change in apparent temperature")
            } else if (delta >= 3) {
              const add = 9 * w
              score += add
              bump(breakdown, "apparentTemperature", add)
              reasons.push("Feels-like temperature shifting")
            }
          }
        }
        if (ap >= 32) {
          const add = 12 * w
          score += add
          bump(breakdown, "apparentTemperature", add)
          reasons.push("Very high apparent heat")
        } else if (ap <= -12) {
          const add = 12 * w
          score += add
          bump(breakdown, "apparentTemperature", add)
          reasons.push("Very cold feels-like temperature")
        }
      }
    }

    if (flags.humidity && wt("humidity") > 0) {
      const w = wt("humidity")
      const h = hour.humidityPct
      if (h != null) {
        if (h >= 90) {
          const add = 16 * w
          score += add
          bump(breakdown, "humidity", add)
          reasons.push("Very high humidity")
        } else if (h >= 85) {
          const add = 9 * w
          score += add
          bump(breakdown, "humidity", add)
          reasons.push("High humidity")
        }
      }
    }

    if (flags.dewpoint && wt("dewpoint") > 0) {
      const w = wt("dewpoint")
      const d = hour.dewpointC
      if (d != null) {
        if (d >= 24) {
          const add = 12 * w
          score += add
          bump(breakdown, "dewpoint", add)
          reasons.push("Very muggy dew point")
        } else if (d >= 20) {
          const add = 7 * w
          score += add
          bump(breakdown, "dewpoint", add)
          reasons.push("Elevated dew point")
        }
      }
    }

    if (flags.precipitation && wt("precipitation") > 0) {
      const w = wt("precipitation")
      const rain = hour.rainMm
      if (rain != null) {
        if (rain >= 1) {
          const add = 22 * w
          score += add
          bump(breakdown, "precipitation", add)
          reasons.push("Heavy precipitation this hour")
        } else if (rain >= 0.3) {
          const add = 10 * w
          score += add
          bump(breakdown, "precipitation", add)
          reasons.push("Wet / changing conditions")
        }
      }
    }

    if (flags.precipitationProbability && wt("precipitationProbability") > 0) {
      const w = wt("precipitationProbability")
      const p = hour.precipProbabilityPct
      if (p != null) {
        if (p >= 85) {
          const add = 9 * w
          score += add
          bump(breakdown, "precipitationProbability", add)
          reasons.push("Very high chance of precipitation")
        } else if (p >= 70) {
          const add = 5 * w
          score += add
          bump(breakdown, "precipitationProbability", add)
          reasons.push("High precipitation probability")
        }
      }
    }

    if (flags.pressure && wt("pressure") > 0 && i > 0) {
      const w = wt("pressure")
      const prev = hours[i - 1].pressureHpa
      const cur = hour.pressureHpa
      if (prev != null && cur != null) {
        const delta = Math.abs(cur - prev)
        if (delta >= 5) {
          const add = 24 * w
          score += add
          bump(breakdown, "pressure", add)
          reasons.push("Strong hour-over-hour pressure change")
        } else if (delta >= 3) {
          const add = 14 * w
          score += add
          bump(breakdown, "pressure", add)
          reasons.push("Notable pressure change")
        }
      }
    }

    if (flags.weatherCode && wt("weatherCode") > 0) {
      const w = wt("weatherCode")
      const { score: s, reason } = weatherCodePenalty(hour.weatherCode)
      if (s > 0 && reason) {
        const add = s * w
        score += add
        bump(breakdown, "weatherCode", add)
        reasons.push(reason)
      }
    }

    if (flags.cloudCover && wt("cloudCover") > 0) {
      const w = wt("cloudCover")
      const cc = hour.cloudCoverPct
      if (cc != null) {
        if (cc <= 10) {
          const add = 5 * w
          score += add
          bump(breakdown, "cloudCover", add)
          reasons.push("Mostly clear sky (bright light)")
        } else if (cc >= 92) {
          const add = 5 * w
          score += add
          bump(breakdown, "cloudCover", add)
          reasons.push("Very overcast")
        }
      }
    }

    if (flags.wind && wt("wind") > 0) {
      const w = wt("wind")
      const wind = hour.windSpeedKmh
      if (wind != null) {
        if (wind >= 55) {
          const add = 16 * w
          score += add
          bump(breakdown, "wind", add)
          reasons.push("Very strong sustained wind")
        } else if (wind >= 40) {
          const add = 9 * w
          score += add
          bump(breakdown, "wind", add)
          reasons.push("Strong wind")
        }
      }
    }

    if (flags.windGusts && wt("windGusts") > 0 && i > 0) {
      const w = wt("windGusts")
      const prev = hours[i - 1].windGustsKmh
      const cur = hour.windGustsKmh
      if (prev != null && cur != null) {
        const delta = Math.abs(cur - prev)
        if (delta >= 20) {
          const add = 14 * w
          score += add
          bump(breakdown, "windGusts", add)
          reasons.push("Sharp increase in wind gusts")
        } else if (delta >= 12) {
          const add = 8 * w
          score += add
          bump(breakdown, "windGusts", add)
          reasons.push("Gusts changing vs prior hour")
        }
      }
    }

    if (flags.visibility && wt("visibility") > 0) {
      const w = wt("visibility")
      const vis = hour.visibilityM
      if (vis != null) {
        if (vis < 1000) {
          const add = 16 * w
          score += add
          bump(breakdown, "visibility", add)
          reasons.push("Very poor visibility")
        } else if (vis < 4000) {
          const add = 9 * w
          score += add
          bump(breakdown, "visibility", add)
          reasons.push("Reduced visibility")
        }
      }
    }

    if (flags.uv && wt("uv") > 0) {
      const w = wt("uv")
      const uv = hour.uvIndex
      if (uv != null) {
        if (uv >= 6) {
          const add = 28 * w
          score += add
          bump(breakdown, "uv", add)
          reasons.push("High UV exposure risk")
        } else if (uv >= 3) {
          const add = 12 * w
          score += add
          bump(breakdown, "uv", add)
          reasons.push("Moderate UV")
        }
      }
    }

    if (flags.aqi && wt("aqi") > 0) {
      const w = wt("aqi")
      const aqi = hour.europeanAqi
      if (aqi != null) {
        if (aqi >= 75) {
          const add = 26 * w
          score += add
          bump(breakdown, "aqi", add)
          reasons.push("Poor European AQI")
        } else if (aqi >= 55) {
          const add = 16 * w
          score += add
          bump(breakdown, "aqi", add)
          reasons.push("Moderate–elevated AQI")
        } else if (aqi >= 40) {
          const add = 8 * w
          score += add
          bump(breakdown, "aqi", add)
          reasons.push("Fair AQI")
        }
      }
    }

    if (flags.particulates && wt("particulates") > 0) {
      const w = wt("particulates")
      const pm25 = hour.pm25
      const pm10 = hour.pm10
      let add = 0
      if (pm25 != null) {
        if (pm25 >= 50) add += 22
        else if (pm25 >= 25) add += 14
        else if (pm25 >= 15) add += 7
      }
      if (pm10 != null) {
        if (pm10 >= 100) add += 14
        else if (pm10 >= 50) add += 9
      }
      add *= w
      if (add >= 8) reasons.push("Elevated particulate levels")
      else if (add >= 4) reasons.push("Some fine particle exposure")
      score += add
      bump(breakdown, "particulates", add)
    }

    if (flags.ozone && wt("ozone") > 0) {
      const w = wt("ozone")
      const o = hour.ozone
      if (o != null) {
        let add = 0
        if (o >= 180) add += 18
        else if (o >= 120) add += 11
        else if (o >= 100) add += 6
        add *= w
        if (add >= 6) reasons.push("Elevated ozone")
        score += add
        bump(breakdown, "ozone", add)
      }
    }

    if (flags.nitrogenDioxide && wt("nitrogenDioxide") > 0) {
      const w = wt("nitrogenDioxide")
      const no2 = hour.nitrogenDioxide
      if (no2 != null) {
        let add = 0
        if (no2 >= 200) add += 16
        else if (no2 >= 120) add += 10
        else if (no2 >= 80) add += 5
        add *= w
        if (add >= 5) reasons.push("Elevated nitrogen dioxide")
        score += add
        bump(breakdown, "nitrogenDioxide", add)
      }
    }

    if (flags.carbonMonoxide && wt("carbonMonoxide") > 0) {
      const w = wt("carbonMonoxide")
      const co = hour.carbonMonoxide
      if (co != null) {
        let add = 0
        if (co >= 5000) add += 14
        else if (co >= 2000) add += 8
        add *= w
        if (add >= 6) reasons.push("Elevated carbon monoxide signal")
        score += add
        bump(breakdown, "carbonMonoxide", add)
      }
    }

    if (flags.pollen && wt("pollen") > 0) {
      const w = wt("pollen")
      const pollen = hour.pollenMax
      if (pollen != null) {
        if (pollen >= 80) {
          const add = 22 * w
          score += add
          bump(breakdown, "pollen", add)
          reasons.push("Very high pollen")
        } else if (pollen >= 40) {
          const add = 14 * w
          score += add
          bump(breakdown, "pollen", add)
          reasons.push("High pollen")
        } else if (pollen >= 15) {
          const add = 8 * w
          score += add
          bump(breakdown, "pollen", add)
          reasons.push("Moderate pollen")
        }
      }
    }

    return {
      ...hour,
      score: clampScore(Math.round(score)),
      reasons,
      breakdown,
    }
  })
}

export function rollupHours(scored) {
  if (!scored.length) return null
  let worst = scored[0]
  for (const row of scored) {
    if (row.score > worst.score) worst = row
  }
  const meanScoreRaw =
    scored.reduce((acc, row) => acc + row.score, 0) / scored.length
  const meanScore = clampScore(Math.round(meanScoreRaw))
  const worstScore = clampScore(Math.round(worst.score ?? 0))
  const dayImpactScore = clampScore(
    Math.round(meanScore * 0.6 + worstScore * 0.4),
  )
  const impactBand = impactBandFor(dayImpactScore)
  const impactSummary = impactSummaryForBand(impactBand)
  const breakdown = rollupBreakdown(scored)
  return {
    worst,
    worstScore,
    meanScore,
    dayImpactScore,
    impactBand,
    impactSummary,
    hours: scored,
    breakdown,
  }
}
