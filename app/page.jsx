"use client"

import { Button } from "@/components/ui/button"
import { hourReadoutEntries } from "@/lib/formatImperial"
import { getWeather } from "@/lib/getWeather"
import {
  filterHoursByDatePrefix,
  normalizeHourly,
  todayDatePrefixInTimeZone,
  currentHourPrefixInTimeZone,
} from "@/lib/normalizeHourly"
import {
  DEFAULT_LOCATION,
  defaultParamWeights,
  hasAnyParamEnabled,
  loadLocationPreference,
  locationDisplayName,
  loadParamFlags,
  loadParamWeights,
} from "@/lib/paramPreferences"
import { DEFAULT_FLAGS } from "@/lib/paramConfig"
import {
  rollupHours,
  scoreHours,
  topBreakdownContributors,
} from "@/lib/scoreHours"
import { Settings2 } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useMemo, useState } from "react"

function impactBandTint(score) {
  if (!Number.isFinite(score)) return ""
  if (score <= 25) return "bg-[oklch(0.96_0.03_145/0.35)]"
  if (score <= 50) return "bg-[oklch(0.97_0.04_85/0.38)]"
  if (score <= 75) return "bg-[oklch(0.94_0.07_65/0.4)]"
  return "bg-[oklch(0.92_0.11_35/0.38)]"
}

function impactBorder(score) {
  if (!Number.isFinite(score)) return "border-l-transparent"
  if (score <= 25) return "border-l-[oklch(0.55_0.12_145)]"
  if (score <= 50) return "border-l-[oklch(0.62_0.1_85)]"
  if (score <= 75) return "border-l-[oklch(0.55_0.14_55)]"
  return "border-l-[oklch(0.5_0.16_35)]"
}

function hourSummaryLine(reasons) {
  if (!reasons?.length) return "Quiet hour."
  return reasons.slice(0, 2).join(" · ")
}

function impactBand(score) {
  if (!Number.isFinite(score)) return "unknown"
  if (score <= 25) return "low"
  if (score <= 50) return "moderate"
  if (score <= 75) return "high"
  return "severe"
}

function impactBandPillClass(band) {
  if (band === "low")
    return "bg-[oklch(0.96_0.03_145/0.55)] text-[oklch(0.34_0.08_145)]"
  if (band === "moderate")
    return "bg-[oklch(0.97_0.04_85/0.58)] text-[oklch(0.4_0.1_85)]"
  if (band === "high")
    return "bg-[oklch(0.94_0.07_65/0.6)] text-[oklch(0.4_0.12_55)]"
  if (band === "severe")
    return "bg-[oklch(0.92_0.11_35/0.58)] text-[oklch(0.34_0.14_35)]"
  return "bg-muted text-muted-foreground"
}

function impactBandLabel(band) {
  if (band === "low") return "Low"
  if (band === "moderate") return "Moderate"
  if (band === "high") return "High"
  if (band === "severe") return "Severe"
  return "Unknown"
}

function nowImpactSummary(score) {
  const band = impactBand(score)
  if (band === "low") return "Outside looks like a minor share of how you feel right now."
  if (band === "moderate")
    return "Outside conditions are likely contributing a noticeable share right now."
  if (band === "high")
    return "Outside conditions look like a major part of how you feel right now."
  if (band === "severe")
    return "Outside conditions may be the dominant driver of how you feel right now."
  return "Current outside impact is unavailable."
}

function formatLocationCoordinates(location) {
  const lat = Number(location?.latitude)
  const lon = Number(location?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ""
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

function DayStrip({ scored }) {
  if (!scored?.length) return null
  return (
    <div
      className="mb-4 flex h-2 w-full gap-px border-y border-border"
      aria-hidden
    >
      {scored.map((r) => (
        <div
          key={r.time}
          className="min-h-px min-w-0 flex-1 bg-primary"
          style={{ opacity: 0.12 + (r.score / 100) * 0.88 }}
          title={`${r.time}: ${r.score}`}
        />
      ))}
    </div>
  )
}

const Home = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rollup, setRollup] = useState(null)
  const [allScored, setAllScored] = useState(null)
  const [currentHour, setCurrentHour] = useState(null)
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }))
  const [weights, setWeights] = useState(() => defaultParamWeights())
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }))

  useEffect(() => {
    setFlags(loadParamFlags())
    setWeights(loadParamWeights())
    setLocation(loadLocationPreference())
    const onFocus = () => {
      setFlags(loadParamFlags())
      setWeights(loadParamWeights())
      setLocation(loadLocationPreference())
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  const readoutCache = useMemo(() => {
    if (!allScored?.length) return null
    const m = new Map()
    for (const row of allScored) {
      const offenders = topBreakdownContributors(row.breakdown, 2)
      const offenderById = new Map(offenders.map((item) => [item.id, item]))
      m.set(row.time, hourReadoutEntries(row, flags, { offenderById }))
    }
    return m
  }, [allScored, flags])

  const load = async () => {
    const f = loadParamFlags()
    const w = loadParamWeights()
    const loc = loadLocationPreference()
    setFlags(f)
    setWeights(w)
    setLocation(loc)
    setLoading(true)
    setError(null)
    setRollup(null)
    setAllScored(null)
    setCurrentHour(null)
    try {
      if (!hasAnyParamEnabled(f)) {
        setError("Turn on at least one parameter in Settings.")
        return
      }
      const { forecast, air, timezone } = await getWeather(f, loc)
      const hours = normalizeHourly(forecast, air, f)
      const todayPrefix = todayDatePrefixInTimeZone(timezone)
      const todayHours = filterHoursByDatePrefix(hours, todayPrefix)
      const scored = scoreHours(todayHours, f, w)
      setAllScored(scored)
      setRollup(rollupHours(scored))
      const nowPrefix = currentHourPrefixInTimeZone(timezone)
      const current = scored.find((h) => h.time === nowPrefix) || null
      setCurrentHour(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const canLoad = hasAnyParamEnabled(flags)

  return (
    <div className="field-stagger mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
              Outside impact readout
            </h1>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:hidden"
            >
              <Settings2 className="size-3.5" strokeWidth={1.75} />
              Settings
            </Link>
          </div>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
            Answers two things: how much outside may be affecting you right now, and
            how hard outside is likely to push on you if you do outside things today.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Location: {locationDisplayName(location)} ·{" "}
            <span className="font-data">{formatLocationCoordinates(location)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/settings"
            className="hidden items-center gap-1.5 text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Settings2 className="size-3.5" strokeWidth={1.75} />
            Settings
          </Link>
          <Button
            type="button"
            onClick={load}
            disabled={loading || !canLoad}
            className="shrink-0"
          >
            {loading ? "Loading…" : "Load today"}
          </Button>
        </div>
      </div>

      {!canLoad ? (
        <div className="border-l-2 border-primary/40 pl-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing is included yet. Choose what outside means for you in Settings,
            set how strongly each factor counts, then load today&apos;s hours.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/settings">Open Settings</Link>
          </Button>
        </div>
      ) : null}

      {error ? (
        <p
          className="border-l-2 border-destructive pl-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading && !rollup ? (
        <div
          className="readout-instrument grid min-h-[230px] animate-pulse grid-cols-1 gap-4 md:grid-cols-2"
          aria-hidden
        />
      ) : null}

      {currentHour || rollup ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="readout-instrument px-4 py-4 sm:px-5 sm:py-5">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              How much of this might be outside right now?
            </h2>
            {currentHour ? (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className={`flex shrink-0 items-center justify-center rounded-full border-4 border-background aspect-square w-24 sm:w-24 ${impactBandTint(currentHour.score)}`}>
                  <span className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                    {currentHour.score}
                  </span>
                </div>
                <div className="min-w-0 space-y-2">
                  <p
                    className={`inline-flex rounded-full px-2.5 py-1 font-data text-[11px] uppercase tracking-[0.12em] ${impactBandPillClass(impactBand(currentHour.score))}`}
                  >
                    {impactBandLabel(impactBand(currentHour.score))} outside effect
                  </p>
                  <p className="text-sm leading-snug text-foreground">
                    {nowImpactSummary(currentHour.score)}
                  </p>
                  {currentHour.reasons?.length ? (
                    <ul className="space-y-1.5 font-sans text-xs leading-snug text-muted-foreground sm:text-sm">
                      {currentHour.reasons.slice(0, 3).map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-sans text-sm text-muted-foreground">
                      No strong outside signals are elevated right now.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                No matching current-hour reading yet. Load today to evaluate immediate
                outside impact.
              </p>
            )}
          </article>

          <article className="readout-instrument px-4 py-4 sm:px-5 sm:py-5">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              If you go outside today, what is the overall hit?
            </h2>
            {rollup ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-end gap-3">
                  <span className="font-heading text-4xl font-semibold tabular-nums leading-none text-foreground">
                    {rollup.dayImpactScore}
                  </span>
                  <span
                    className={`mb-1 inline-flex rounded-full px-2.5 py-1 font-data text-[11px] uppercase tracking-[0.12em] ${impactBandPillClass(rollup.impactBand)}`}
                  >
                    {impactBandLabel(rollup.impactBand)}
                  </span>
                </div>
                <p className="text-sm leading-snug text-foreground">
                  {rollup.impactSummary}
                </p>
                <p className="font-data text-xs leading-relaxed text-muted-foreground">
                  Blend: mean {rollup.meanScore} + peak {rollup.worstScore}
                  {rollup.worst?.time
                    ? ` (${rollup.worst.time.slice(11, 16)})`
                    : ""}
                  .
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Day impact appears after loading today&apos;s hours.
              </p>
            )}
          </article>
        </section>
      ) : null}

      {rollup ? (
        <section className="readout-instrument px-4 py-4 sm:px-5 sm:py-5">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Why this day looks this way
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Biggest contributors and the hardest window, without chart decoding.
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Top drivers today
              </p>
              {rollup.breakdown?.items?.length ? (
                <ul className="mt-3 space-y-2.5">
                  {rollup.breakdown.items.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-foreground">
                          {item.label}
                        </span>
                        <span className="font-data shrink-0 text-xs tabular-nums text-muted-foreground">
                          {Math.round(item.pct)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-border/70">
                        <div
                          className="h-full bg-foreground/45"
                          style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No strong outside drivers were recorded.
                </p>
              )}
            </div>
            <div className="space-y-4 border-t border-border pt-4 md:border-t-0 md:border-l md:pl-4 md:pt-0">
              <div>
                <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Hardest outside hour
                </p>
                {rollup.worst?.time ? (
                  <p className="mt-2 font-data text-sm text-foreground">
                    <span className="tabular-nums">{rollup.worst.time.slice(11, 16)}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · impact{" "}
                      <span className="tabular-nums font-medium text-foreground">
                        {rollup.worst.score}
                      </span>
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No peak hour available.
                  </p>
                )}
              </div>
              {rollup.worst?.reasons?.length ? (
                <div>
                  <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Main signals at that hour
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                    {rollup.worst.reasons.slice(0, 4).map((r, i) => (
                      <li key={`${i}-${r}`} className="flex items-start gap-2">
                        <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {allScored?.length ? (
        <div>
          <h2 className="font-heading mb-1 text-lg font-semibold text-foreground">
            Field log
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This is the evidence behind the verdict. Strip shows relative impact by
            hour (darker = stronger outside pressure); open rows for full readings.
          </p>
          <DayStrip scored={allScored} />
          <div className="border border-border">
            {allScored.map((row, i) => (
              <details
                key={row.time}
                className={`group border-b border-border last:border-b-0 ${impactBandTint(row.score)} ${i % 2 === 1 ? "bg-muted/10" : ""}`}
              >
                <summary className="cursor-pointer list-none py-3 pl-1 pr-2 marker:content-none [&::-webkit-details-marker]:hidden">
                  <div
                    className={`grid grid-cols-[minmax(5rem,7rem)_2.5rem_1fr] items-baseline gap-3 border-l-[3px] pl-3 sm:grid-cols-[7rem_3rem_1fr] ${impactBorder(row.score)}`}
                  >
                    <span className="font-data text-sm tabular-nums text-foreground">
                      {row.time.slice(11, 16)}
                    </span>
                    <span className="font-data text-sm font-semibold tabular-nums text-foreground">
                      {row.score}
                    </span>
                    <span className="text-sm leading-snug text-muted-foreground">
                      {hourSummaryLine(row.reasons)}
                    </span>
                  </div>
                </summary>
                <div className="border-t border-border/80 bg-background/40 px-3 py-4 pl-[calc(0.75rem+3px)] sm:pl-6">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {(readoutCache?.get(row.time) ?? []).map(
                      ({
                        id,
                        term,
                        desc,
                        blurb,
                        referenceRange,
                        flaggedWhen,
                        isOffender,
                        offenderPct,
                      }) => (
                        <div
                          key={`${row.time}-${id}`}
                          className={`relative flex flex-col gap-0.5 rounded-sm px-2 py-1.5 -mx-2 sm:flex-row sm:gap-2 ${isOffender ? "border-l-2 border-l-[oklch(0.5_0.16_35)] bg-[oklch(0.94_0.07_35/0.22)] pl-[calc(0.5rem-2px)]" : ""}`}
                        >
                          <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-32">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{term}</span>
                              <details className="relative">
                                <summary
                                  className="inline-flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded-full border border-border text-[10px] font-semibold leading-none text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden focus-visible:border-primary focus-visible:text-foreground"
                                  aria-label={`${term} details`}
                                >
                                  ?
                                </summary>
                                <div
                                  role="tooltip"
                                  className="absolute left-0 top-full z-20 mt-1 w-[min(24rem,calc(100vw-3.5rem))] rounded-md border border-border bg-background px-3 py-2 shadow-lg"
                                >
                                  {blurb ? (
                                    <p className="text-xs leading-snug text-foreground">{blurb}</p>
                                  ) : null}
                                  {referenceRange ? (
                                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                                      Typical range: {referenceRange}
                                    </p>
                                  ) : null}
                                  {flaggedWhen ? (
                                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                                      Flag trigger: {flaggedWhen}
                                    </p>
                                  ) : null}
                                  {isOffender ? (
                                    <p className="mt-1 text-xs leading-snug text-[oklch(0.42_0.12_35)]">
                                      Main contributor to this hour&apos;s score.
                                    </p>
                                  ) : null}
                                </div>
                              </details>
                            </span>
                          </dt>
                          <dd className="font-data text-sm tabular-nums text-foreground">
                            <span className={`${isOffender ? "font-semibold text-foreground" : ""}`}>
                              {desc}
                            </span>
                            {referenceRange ? (
                              <p className="font-sans text-[11px] leading-snug text-muted-foreground">
                                Ref: {referenceRange}
                              </p>
                            ) : null}
                            {isOffender ? (
                              <p className="font-sans text-[11px] leading-snug text-[oklch(0.42_0.12_35)]">
                                Main offender this hour ({Math.round(offenderPct)}% of penalty)
                              </p>
                            ) : null}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </div>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Home
