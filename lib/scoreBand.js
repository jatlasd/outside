export function bandForScore(score) {
  if (!Number.isFinite(score)) return "unknown"
  if (score <= 25) return "low"
  if (score <= 50) return "moderate"
  if (score <= 75) return "high"
  return "severe"
}

export function scoreBandLabel(band) {
  if (band === "low") return "Low"
  if (band === "moderate") return "Moderate"
  if (band === "high") return "High"
  if (band === "severe") return "Severe"
  return "Unknown"
}
