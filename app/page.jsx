"use client"

import { Button } from "@/components/ui/button"
import { hourReadoutEntries, yesterdayComparisonLine } from "@/lib/formatImperial"
import { getWeather } from "@/lib/getWeather"
import { formatLocationCoordinates } from "@/lib/locationFormat"
import {
  filterHoursByDatePrefix,
  normalizeHourly,
  todayDatePrefixInTimeZone,
  calendarDatePrefixInTimeZone,
  sameClockHourOnDatePrefix,
  currentHourPrefixInTimeZone,
} from "@/lib/normalizeHourly"
import {
  ACTIVE_PROFILE_STORAGE_KEY,
  DEFAULT_LOCATION,
  defaultParamWeights,
  getActiveProfileId,
  hasAnyParamEnabled,
  loadLocationPreference,
  locationDisplayName,
  loadParamFlags,
  loadParamWeights,
  markWeatherReadoutLoaded,
  PROFILE_READOUT_LOADED_KEY,
  takeReadoutAutoRefreshIfNeeded,
} from "@/lib/paramPreferences"
import { DEFAULT_FLAGS } from "@/lib/paramConfig"
import { bandForScore, scoreBandLabel } from "@/lib/scoreBand"
import {
  rollupHours,
  scoreHours,
  topBreakdownContributors,
} from "@/lib/scoreHours"
import { formatTimeKey12Hour } from "@/lib/time"
import { Settings2 } from "lucide-react"
import Link from "next/link"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

const BAND_TINT = {
  low: "bg-[oklch(0.96_0.03_145/0.35)]",
  moderate: "bg-[oklch(0.97_0.04_85/0.38)]",
  high: "bg-[oklch(0.94_0.07_65/0.4)]",
  severe: "bg-[oklch(0.92_0.11_35/0.38)]",
}

const BAND_BORDER = {
  low: "border-l-[oklch(0.55_0.12_145)]",
  moderate: "border-l-[oklch(0.62_0.1_85)]",
  high: "border-l-[oklch(0.55_0.14_55)]",
  severe: "border-l-[oklch(0.5_0.16_35)]",
}

const BAND_PILL = {
  low: "bg-[oklch(0.96_0.03_145/0.55)] text-[oklch(0.34_0.08_145)]",
  moderate: "bg-[oklch(0.97_0.04_85/0.58)] text-[oklch(0.4_0.1_85)]",
  high: "bg-[oklch(0.94_0.07_65/0.6)] text-[oklch(0.4_0.12_55)]",
  severe: "bg-[oklch(0.92_0.11_35/0.58)] text-[oklch(0.34_0.14_35)]",
}

function impactBandTint(score) {
  return BAND_TINT[bandForScore(score)] ?? ""
}

function impactBorder(score) {
  return BAND_BORDER[bandForScore(score)] ?? "border-l-transparent"
}

function impactBandPillClass(band) {
  return BAND_PILL[band] ?? "bg-muted text-muted-foreground"
}

function nowImpactSummary(score) {
  if (!Number.isFinite(score)) return "Current outside impact is unavailable."
  if (score <= 25) return "Outside looks like a minor share of how you feel right now."
  if (score <= 50) return "Outside conditions are likely contributing a noticeable share right now."
  if (score <= 75) return "Outside conditions look like a major part of how you feel right now."
  return "Outside conditions may be the dominant driver of how you feel right now."
}

function hourSummaryLine(reasons) {
  if (!reasons?.length) return "Quiet hour."
  return reasons[0]
}

function prioritizedEntries(entries, count) {
  const offenders = entries.filter((e) => e.isOffender)
  const remainder = entries.filter((e) => !e.isOffender)
  return [...offenders, ...remainder].slice(0, count)
}

function DayStrip({ scored, selectedTime, onSelect }) {
  const scrollRef = useRef(null)
  const batchKeyRef = useRef(null)
  const lastCenteredTimeRef = useRef(null)

  useLayoutEffect(() => {
    if (!scored?.length || !selectedTime) return
    const batchKey = scored.map((r) => r.time).join("|")
    const batchChanged = batchKeyRef.current !== batchKey
    const selectionChanged = lastCenteredTimeRef.current !== selectedTime
    if (!batchChanged && !selectionChanged) return
    if (batchChanged) batchKeyRef.current = batchKey
    lastCenteredTimeRef.current = selectedTime
    const root = scrollRef.current
    const el = root?.querySelector?.(`[data-hour="${CSS.escape(selectedTime)}"]`)
    el?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [scored, selectedTime])

  if (!scored?.length) return null
  return (
    <div ref={scrollRef} className="mb-4 overflow-x-auto border-y border-border">
      <div className="flex items-end gap-1.5 px-1 py-2" style={{ minWidth: scored.length * 80 }}>
        {scored.map((r) => {
          const selected = selectedTime === r.time
          const opacity = 0.15 + (r.score / 100) * 0.85
          return (
            <button
              key={r.time}
              type="button"
              data-hour={r.time}
              onClick={() => onSelect?.(r.time)}
              className={`flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-lg pb-1.5 pt-1 transition-colors ${selected ? "border-[1.5px] border-foreground bg-[oklch(0.93_0.015_85/0.35)]" : "border-[1.5px] border-transparent hover:bg-muted/30"}`}
              aria-label={`Select ${formatTimeKey12Hour(r.time)}`}
              aria-pressed={selected}
            >
              <div className="flex w-full items-end justify-center">
                <div
                  className="w-[calc(100%-8px)] rounded bg-primary"
                  style={{ opacity, height: 40 }}
                />
              </div>
              <span className={`font-data text-[11px] ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                {formatTimeKey12Hour(r.time)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HourRow({ row, readoutEntries, isEven, defaultExpanded, hideSummaryTap, showYesterdayHint }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAllMetrics, setShowAllMetrics] = useState(false)
  const band = bandForScore(row.score)
  const primaryEntries = prioritizedEntries(readoutEntries ?? [], 3)
  const visibleEntries = showAllMetrics ? (readoutEntries ?? []) : primaryEntries

  const toggle = useCallback(() => {
    if (hideSummaryTap) return
    setExpanded((v) => !v)
  }, [hideSummaryTap])

  return (
    <div className={`border-b border-border ${impactBandTint(row.score)} ${isEven ? "bg-muted/10" : ""}`}>
      {hideSummaryTap ? (
        <div className={`grid grid-cols-[minmax(5rem,7rem)_2.5rem_1fr] items-baseline gap-3 border-l-[3px] py-3 pl-3 pr-2 sm:grid-cols-[7rem_3rem_1fr] ${impactBorder(row.score)}`}>
          <span className="font-data text-sm tabular-nums text-foreground">
            {formatTimeKey12Hour(row.time)}
          </span>
          <span className="font-data text-sm font-semibold tabular-nums text-foreground">
            {row.score}
          </span>
          <span className="text-sm leading-snug text-muted-foreground">
            {hourSummaryLine(row.reasons)}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className={`grid w-full cursor-pointer grid-cols-[minmax(5rem,7rem)_2.5rem_1fr] items-baseline gap-3 border-l-[3px] py-3 pl-3 pr-2 text-left sm:grid-cols-[7rem_3rem_1fr] ${impactBorder(row.score)}`}
          aria-label={`Toggle details for ${formatTimeKey12Hour(row.time)}`}
        >
          <span className="font-data text-sm tabular-nums text-foreground">
            {formatTimeKey12Hour(row.time)}
          </span>
          <span className="font-data text-sm font-semibold tabular-nums text-foreground">
            {row.score}
          </span>
          <span className="text-sm leading-snug text-muted-foreground">
            {hourSummaryLine(row.reasons)}
          </span>
        </button>
      )}

      {!expanded && row.reasons?.length > 1 && (
        <p className="pb-1.5 pl-[calc(0.75rem+3px)] text-[11px] text-muted-foreground sm:pl-6">
          +{row.reasons.length - 1} more signals
        </p>
      )}

      {!hideSummaryTap && (
        <div className="pb-2.5 pl-[calc(0.75rem+3px)] sm:pl-6">
          <button type="button" onClick={toggle} className="text-xs font-medium text-foreground">
            {expanded ? "Hide details" : "Show details"}
          </button>
        </div>
      )}

      {expanded && visibleEntries?.length > 0 && (
        <div className="border-t border-border/80 bg-background/40 px-3 py-4 pl-[calc(0.75rem+3px)] sm:pl-6">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {visibleEntries.map(({ id, term, desc, blurb, referenceRange, flaggedWhen, isOffender, offenderPct, yesterdayLine }) => (
              <div
                key={`${row.time}-${id}`}
                className={`relative -mx-2 flex flex-col gap-0.5 rounded-sm px-2 py-1.5 sm:flex-row sm:gap-2 ${isOffender ? "border-l-2 border-l-[oklch(0.5_0.16_35)] bg-[oklch(0.94_0.07_35/0.22)] pl-[calc(0.5rem-2px)]" : ""}`}
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
                        {blurb ? <p className="text-xs leading-snug text-foreground">{blurb}</p> : null}
                        {referenceRange ? <p className="mt-1 text-xs leading-snug text-muted-foreground">Typical range: {referenceRange}</p> : null}
                        {flaggedWhen ? <p className="mt-1 text-xs leading-snug text-muted-foreground">Flag trigger: {flaggedWhen}</p> : null}
                        {isOffender ? <p className="mt-1 text-xs leading-snug text-[oklch(0.42_0.12_35)]">Main contributor to this hour&apos;s score.</p> : null}
                      </div>
                    </details>
                  </span>
                </dt>
                <dd className="font-data text-sm tabular-nums text-foreground">
                  <span className={isOffender ? "font-semibold text-foreground" : ""}>{desc}</span>
                  {showYesterdayHint && yesterdayLine ? (
                    <p className="mt-1 font-sans text-[11px] font-normal leading-snug text-muted-foreground">
                      {yesterdayLine}
                    </p>
                  ) : null}
                  {showAllMetrics && referenceRange ? <p className="font-sans text-[11px] leading-snug text-muted-foreground">Ref: {referenceRange}</p> : null}
                  {isOffender ? <p className="font-sans text-[11px] leading-snug text-[oklch(0.42_0.12_35)]">Main offender this hour ({Math.round(offenderPct)}% of penalty)</p> : null}
                </dd>
              </div>
            ))}
          </dl>
          {readoutEntries?.length > primaryEntries.length && (
            <button type="button" onClick={() => setShowAllMetrics((v) => !v)} className="mt-2 text-xs font-medium text-foreground">
              {showAllMetrics ? "Show key metrics only" : `Show all metrics (${readoutEntries.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const Home = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [weatherNormalizedHours, setWeatherNormalizedHours] = useState(null)
  const [weatherTimezone, setWeatherTimezone] = useState(null)
  const [viewedDayOffset, setViewedDayOffset] = useState(0)
  const [selectedHourTime, setSelectedHourTime] = useState(null)
  const [showAllHours, setShowAllHours] = useState(false)
  const [showDayBreakdown, setShowDayBreakdown] = useState(false)
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }))
  const [weights, setWeights] = useState(() => defaultParamWeights())
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }))
  const loadRequestIdRef = useRef(0)
  const lastActiveProfileRef = useRef(null)

  const viewedDatePrefix = useMemo(() => {
    if (!weatherTimezone) return null
    return calendarDatePrefixInTimeZone(weatherTimezone, viewedDayOffset)
  }, [weatherTimezone, viewedDayOffset])

  const allScored = useMemo(() => {
    if (!viewedDatePrefix || !weatherNormalizedHours?.length) return null
    const dayHours = filterHoursByDatePrefix(weatherNormalizedHours, viewedDatePrefix)
    const scored = scoreHours(dayHours, flags, weights)
    return scored.length ? scored : null
  }, [weatherNormalizedHours, viewedDatePrefix, flags, weights])

  const rollup = useMemo(() => {
    if (!allScored?.length) return null
    return rollupHours(allScored)
  }, [allScored])

  const hourByTime = useMemo(() => {
    if (!weatherNormalizedHours?.length) return new Map()
    return new Map(weatherNormalizedHours.map((h) => [h.time, h]))
  }, [weatherNormalizedHours])

  const syncPreferencesFromStorage = useCallback(() => {
    const id = getActiveProfileId()
    lastActiveProfileRef.current = id
    setFlags(loadParamFlags())
    setWeights(loadParamWeights())
    setLocation(loadLocationPreference())
    return id
  }, [])

  const priorDayComparisonLabel = useMemo(() => {
    if (viewedDayOffset === 0) return "Yesterday"
    if (viewedDayOffset === 1) return "Today"
    return "2 days ago"
  }, [viewedDayOffset])

  const readoutCache = useMemo(() => {
    if (!allScored?.length || !weatherTimezone) return null
    const priorPrefix = calendarDatePrefixInTimeZone(weatherTimezone, viewedDayOffset - 1)
    const m = new Map()
    for (const row of allScored) {
      const offenders = topBreakdownContributors(row.breakdown, 2)
      const offenderById = new Map(offenders.map((item) => [item.id, item]))
      const yKey = sameClockHourOnDatePrefix(row.time, priorPrefix)
      const yRow = yKey ? hourByTime.get(yKey) : null
      const compareYesterday = new Map()
      if (yRow) {
        for (const id of Object.keys(flags)) {
          if (!flags[id]) continue
          const line = yesterdayComparisonLine(id, row, yRow, priorDayComparisonLabel)
          if (line) compareYesterday.set(id, line)
        }
      }
      m.set(row.time, hourReadoutEntries(row, flags, { offenderById, compareYesterday }))
    }
    return m
  }, [allScored, flags, hourByTime, weatherTimezone, viewedDayOffset, priorDayComparisonLabel])

  const invalidateReadoutState = useCallback(() => {
    setError(null)
    setWeatherNormalizedHours(null)
    setWeatherTimezone(null)
    setViewedDayOffset(0)
    setSelectedHourTime(null)
    setShowAllHours(false)
    setShowDayBreakdown(false)
  }, [])

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current
    const f = loadParamFlags()
    const w = loadParamWeights()
    const loc = loadLocationPreference()
    if (requestId !== loadRequestIdRef.current) return
    setFlags(f)
    setWeights(w)
    setLocation(loc)
    setLoading(true)
    invalidateReadoutState()
    try {
      if (!hasAnyParamEnabled(f)) {
        if (requestId !== loadRequestIdRef.current) return
        setError("Turn on at least one parameter in Settings.")
        return
      }
      const { forecast, air, timezone } = await getWeather(f, loc, { pastDays: 2 })
      if (requestId !== loadRequestIdRef.current) return
      const hours = normalizeHourly(forecast, air, f)
      const todayPrefix = todayDatePrefixInTimeZone(timezone)
      const todayHours = filterHoursByDatePrefix(hours, todayPrefix)
      if (!todayHours.length) {
        setError("No usable hourly readings are available for today at this location.")
        return
      }
      setWeatherNormalizedHours(hours)
      setWeatherTimezone(timezone)
      setViewedDayOffset(0)
      markWeatherReadoutLoaded()
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      if (requestId !== loadRequestIdRef.current) return
      setLoading(false)
    }
  }, [invalidateReadoutState])

  useEffect(() => {
    if (!allScored?.length) {
      setSelectedHourTime(null)
      return
    }
    setSelectedHourTime((prev) => {
      if (prev && viewedDatePrefix) {
        const mapped = sameClockHourOnDatePrefix(prev, viewedDatePrefix)
        if (mapped && allScored.some((h) => h.time === mapped)) return mapped
      }
      if (viewedDayOffset === 0 && weatherTimezone) {
        const nowPrefix = currentHourPrefixInTimeZone(weatherTimezone)
        const hit = allScored.find((h) => h.time === nowPrefix)
        if (hit) return hit.time
      }
      return allScored[0].time
    })
  }, [allScored, viewedDatePrefix, viewedDayOffset, weatherTimezone])

  const yesterdayPrefix = useMemo(() => {
    if (!weatherTimezone) return null
    return calendarDatePrefixInTimeZone(weatherTimezone, -1)
  }, [weatherTimezone])

  const tomorrowPrefix = useMemo(() => {
    if (!weatherTimezone) return null
    return calendarDatePrefixInTimeZone(weatherTimezone, 1)
  }, [weatherTimezone])

  const hasYesterdayHours = useMemo(() => {
    if (!yesterdayPrefix || !weatherNormalizedHours?.length) return false
    return weatherNormalizedHours.some((h) => h.time.startsWith(yesterdayPrefix))
  }, [yesterdayPrefix, weatherNormalizedHours])

  const hasTomorrowHours = useMemo(() => {
    if (!tomorrowPrefix || !weatherNormalizedHours?.length) return false
    return weatherNormalizedHours.some((h) => h.time.startsWith(tomorrowPrefix))
  }, [tomorrowPrefix, weatherNormalizedHours])

  const currentHour = useMemo(() => {
    if (viewedDayOffset !== 0 || !allScored?.length || !weatherTimezone) return null
    const nowPrefix = currentHourPrefixInTimeZone(weatherTimezone)
    return allScored.find((h) => h.time === nowPrefix) ?? null
  }, [viewedDayOffset, allScored, weatherTimezone])

  const tryReloadAfterProfileChange = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      if (window.sessionStorage.getItem(PROFILE_READOUT_LOADED_KEY) !== "1") return
      const f = loadParamFlags()
      if (!hasAnyParamEnabled(f)) return
      void load()
    } catch {}
  }, [load])

  useEffect(() => {
    const before = lastActiveProfileRef.current
    const id = syncPreferencesFromStorage()
    const profileChanged = before !== null && id !== before
    if (takeReadoutAutoRefreshIfNeeded()) {
      void load()
    } else if (
      profileChanged &&
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(PROFILE_READOUT_LOADED_KEY) === "1"
    ) {
      const f = loadParamFlags()
      if (hasAnyParamEnabled(f)) void load()
    }
    const onFocus = () => {
      const was = lastActiveProfileRef.current
      const now = syncPreferencesFromStorage()
      if (
        was !== null &&
        now !== was &&
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(PROFILE_READOUT_LOADED_KEY) === "1"
      ) {
        const f = loadParamFlags()
        if (hasAnyParamEnabled(f)) void load()
      }
    }
    const onStorage = (e) => {
      if (e.key !== ACTIVE_PROFILE_STORAGE_KEY) return
      syncPreferencesFromStorage()
      tryReloadAfterProfileChange()
    }
    window.addEventListener("focus", onFocus)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("storage", onStorage)
    }
  }, [load, syncPreferencesFromStorage, tryReloadAfterProfileChange])

  const canLoad = hasAnyParamEnabled(flags)

  const selectedHour = useMemo(() => {
    if (!allScored?.length) return null
    if (!selectedHourTime) return allScored[0]
    return allScored.find((item) => item.time === selectedHourTime) ?? allScored[0]
  }, [allScored, selectedHourTime])

  const visibleHours = useMemo(() => {
    if (!allScored?.length) return []
    if (showAllHours) return allScored
    return selectedHour ? [selectedHour] : []
  }, [allScored, showAllHours, selectedHour])

  const viewedDayShortLabel = useMemo(() => {
    if (!viewedDatePrefix) return ""
    const parts = viewedDatePrefix.split("-").map(Number)
    const y = parts[0]
    const mo = parts[1]
    const d = parts[2]
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return viewedDatePrefix
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    try {
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    } catch {
      return viewedDatePrefix
    }
  }, [viewedDatePrefix])

  const dayNavButtonClass = (active) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-foreground hover:bg-muted/40"
    }`

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
            {loading ? "Loading\u2026" : "Load readout"}
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

      {weatherNormalizedHours && !error ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Day
          </span>
          <button
            type="button"
            className={dayNavButtonClass(viewedDayOffset === -1)}
            disabled={!hasYesterdayHours}
            onClick={() => setViewedDayOffset(-1)}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={dayNavButtonClass(viewedDayOffset === 0)}
            onClick={() => setViewedDayOffset(0)}
          >
            Today
          </button>
          <button
            type="button"
            className={dayNavButtonClass(viewedDayOffset === 1)}
            disabled={!hasTomorrowHours}
            onClick={() => setViewedDayOffset(1)}
          >
            Tomorrow
          </button>
          {viewedDatePrefix ? (
            <span className="ml-auto font-data text-xs tabular-nums text-muted-foreground">
              {viewedDayShortLabel} · {viewedDatePrefix}
            </span>
          ) : null}
        </div>
      ) : null}

      {weatherNormalizedHours && !error && !allScored?.length ? (
        <p className="text-sm text-muted-foreground" role="status">
          No hourly readings for this day in the loaded window. Try another day or refresh the readout.
        </p>
      ) : null}

      {currentHour || rollup ? (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="readout-instrument px-4 py-4 sm:px-5 sm:py-5">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              How much of this might be outside right now?
            </h2>
            {currentHour ? (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className={`flex aspect-square w-24 shrink-0 items-center justify-center rounded-full border-4 border-background ${impactBandTint(currentHour.score)}`}>
                  <span className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                    {currentHour.score}
                  </span>
                </div>
                <div className="min-w-0 space-y-2">
                  <p className={`inline-flex rounded-full px-2.5 py-1 font-data text-[11px] uppercase tracking-[0.12em] ${impactBandPillClass(bandForScore(currentHour.score))}`}>
                    {scoreBandLabel(bandForScore(currentHour.score))} outside effect
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
            ) : viewedDayOffset === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                No matching current-hour reading yet. Refresh the readout to evaluate immediate
                outside impact.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Live &ldquo;right now&rdquo; impact is for today only. Use Today above to jump back.
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
                  <span className={`mb-1 inline-flex rounded-full px-2.5 py-1 font-data text-[11px] uppercase tracking-[0.12em] ${impactBandPillClass(rollup.impactBand)}`}>
                    {scoreBandLabel(rollup.impactBand)}
                  </span>
                </div>
                <p className="text-sm leading-snug text-foreground">
                  {rollup.impactSummary}
                </p>
                <p className="font-data text-xs leading-relaxed text-muted-foreground">
                  Blend: mean {rollup.meanScore} + peak {rollup.worstScore}
                  {rollup.worst?.time ? ` (${formatTimeKey12Hour(rollup.worst.time)})` : ""}.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Day impact appears after loading the readout.
              </p>
            )}
          </article>
        </section>
      ) : null}

      {rollup ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDayBreakdown((v) => !v)}
            className="mb-2 text-xs font-medium text-foreground"
          >
            {showDayBreakdown ? "Hide day breakdown" : "Why this day looks this way"}
          </button>
          {showDayBreakdown && (
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
                    Top drivers this day
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
                        <span className="tabular-nums">{formatTimeKey12Hour(rollup.worst.time)}</span>
                        <span className="text-muted-foreground">
                          {" "}&middot; impact{" "}
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
          )}
        </div>
      ) : null}

      {allScored?.length ? (
        <div>
          <h2 className="font-heading mb-1 text-lg font-semibold text-foreground">
            Hourly timeline
            {viewedDayShortLabel ? (
              <span className="ml-2 font-data text-base font-normal text-muted-foreground">
                · {viewedDayShortLabel}
              </span>
            ) : null}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick an hour first. Scroll sideways; each column is one hour. Darker fills mean
            stronger outside pressure. Values show in &deg;F; trend thresholds use &deg;C steps
            internally, then your sensitivity weights apply. Open details to compare the same
            clock hour to the prior calendar day when data is available.
          </p>
          <DayStrip
            scored={allScored}
            selectedTime={selectedHour?.time}
            onSelect={(time) => setSelectedHourTime(time)}
          />
          <button
            type="button"
            onClick={() => setShowAllHours((v) => !v)}
            className="mb-3 text-xs font-medium text-foreground"
          >
            {showAllHours ? "Show selected hour only" : "Show all hours"}
          </button>
          <div className="border border-border">
            {visibleHours.map((row, i) => (
              <HourRow
                key={`${row.time}-${showAllHours}`}
                row={row}
                readoutEntries={readoutCache?.get(row.time) ?? []}
                isEven={i % 2 === 1}
                defaultExpanded={!showAllHours}
                hideSummaryTap={!showAllHours}
                showYesterdayHint={Boolean(readoutCache?.get(row.time)?.some((e) => e.yesterdayLine))}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Home
