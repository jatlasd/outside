"use client"

import { Button } from "@/components/ui/button"
import { resolveZipToLocation } from "@/lib/geocodeZip"
import { formatLocationCoordinates } from "@/lib/locationFormat"
import {
  DEFAULT_FLAGS,
  PARAM_GROUP_LABELS,
  PARAM_REFERENCE,
  PARAMS,
  weightAxesForParam,
} from "@/lib/paramConfig"
import {
  DEFAULT_LOCATION,
  defaultParamWeights,
  loadLocationPreference,
  locationDisplayName,
  loadParamFlags,
  loadParamWeights,
  saveLocationPreference,
  saveParamFlags,
  saveParamWeights,
  WEIGHT_LEVEL_OPTIONS,
} from "@/lib/paramPreferences"
import {
  ArrowLeft,
  CircleHelp,
  Cloud,
  Leaf,
  MapPin,
  Navigation,
  Wind,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

const GROUP_ORDER = ["weather", "air", "allergens"]

const GROUP_ICONS = {
  weather: Cloud,
  air: Wind,
  allergens: Leaf,
}

const GROUP_HINTS = {
  weather: "Core weather signals that shape comfort and outdoor stress.",
  air: "Turning on any air factor adds an extra air-quality data request.",
  allergens: "Turning on pollen factors adds an extra air-quality data request.",
}

const PARAM_TOOLTIP_OVERRIDES = {
  particulates:
    "PM2.5 and PM10 are tiny particles in the air. PM2.5 are very fine particles that can reach deep into your lungs, while PM10 are larger dust-like particles. Higher levels can make breathing and outdoor activity feel harder.",
}

function Toggle({ active, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={`inline-flex h-6 w-11 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
        active
          ? "border-primary/60 bg-primary/90"
          : "border-border bg-muted/50"
      }`}
      onClick={onToggle}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-card shadow-sm transition-transform ${
          active ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  )
}

function WeightPills({ value, onChange }) {
  const displayLabel = (label) => {
    if (label === "Ignore") return "Off"
    return label
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      {WEIGHT_LEVEL_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          aria-pressed={value === opt.value}
          className={`h-8 rounded-md border px-2 text-xs font-medium tracking-wide transition-colors ${
            value === opt.value
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background/70 text-foreground hover:border-foreground/70"
          }`}
          onClick={() => onChange(opt.value)}
        >
          {displayLabel(opt.label)}
        </button>
      ))}
    </div>
  )
}

function paramTooltipText(param) {
  const override = PARAM_TOOLTIP_OVERRIDES[param.id]
  if (override) return override
  const ref = PARAM_REFERENCE[param.id]
  if (!ref) return param.label
  return [ref.blurb, ref.referenceRange, ref.flaggedWhen].filter(Boolean).join(" ")
}

function ParamTooltip({ label, text }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`What is ${label}?`}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <CircleHelp className="size-3.5" strokeWidth={1.75} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-[calc(100%+0.35rem)] z-20 hidden w-[min(20rem,70vw)] rounded-md border border-border bg-card px-2.5 py-2 text-[11px] leading-relaxed text-foreground shadow-xl group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  )
}

function ParamRow({ param, enabled, weightAxes, weightValues, onToggle, onWeightChange }) {
  const tooltipText = paramTooltipText(param)

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <p className="text-sm leading-snug text-foreground">{param.label}</p>
            <ParamTooltip label={param.label} text={tooltipText} />
          </div>
          <p className="font-data mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Included in scoring: {enabled ? "On" : "Off"}
          </p>
        </div>
        <Toggle active={enabled} onToggle={onToggle} />
      </div>
      {enabled ? (
        <div className="mt-2.5 space-y-3">
          {weightAxes.map((axis) => (
            <div key={axis.key}>
              <p className="mb-1.5 font-data text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {axis.label}
              </p>
              <WeightPills
                value={weightValues?.[axis.key] ?? 1}
                onChange={(v) => onWeightChange(axis.key, v)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Turn this on to tune severity.</p>
      )}
    </div>
  )
}

export default function Settings() {
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }))
  const [weights, setWeights] = useState(() => defaultParamWeights())
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }))
  const [zipInput, setZipInput] = useState("")
  const [locationError, setLocationError] = useState(null)
  const [locationNotice, setLocationNotice] = useState(null)
  const [findingZip, setFindingZip] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)

  useEffect(() => {
    setFlags(loadParamFlags())
    setWeights(loadParamWeights())
    const storedLocation = loadLocationPreference()
    setLocation(storedLocation)
    setZipInput(storedLocation.zip || "")
  }, [])

  const updateFlag = useCallback((id, checked) => {
    setFlags((prev) => {
      const next = { ...prev, [id]: checked }
      saveParamFlags(next)
      return next
    })
  }, [])

  const updateWeight = useCallback((id, axisKey, value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setWeights((prev) => {
      const axes = weightAxesForParam(id)
      const fallback = Object.fromEntries(axes.map((axis) => [axis.key, 1]))
      const current = typeof prev[id] === "object" && prev[id] ? prev[id] : fallback
      const nextEntry = { ...fallback, ...current, [axisKey]: Math.max(0, num) }
      const next = { ...prev, [id]: nextEntry }
      saveParamWeights(next)
      return next
    })
  }, [])

  const applyLocation = useCallback((next) => {
    setLocation(next)
    saveLocationPreference(next)
    if (next?.zip) setZipInput(next.zip)
    setLocationError(null)
  }, [])

  const applyZipLocation = useCallback(async (event) => {
    event.preventDefault()
    setFindingZip(true)
    setLocationNotice(null)
    try {
      const next = await resolveZipToLocation(zipInput)
      applyLocation(next)
      setLocationNotice(`Saved: ${locationDisplayName(next)}`)
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : "Unable to resolve ZIP code.",
      )
    } finally {
      setFindingZip(false)
    }
  }, [zipInput, applyLocation])

  const applyCurrentLocation = useCallback(() => {
    setLocationNotice(null)
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.")
      return
    }
    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          source: "geolocation",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "Current location",
          zip: "",
        }
        applyLocation(next)
        setLocationNotice("Saved device coordinates.")
        setDetectingLocation(false)
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission was denied.")
        } else if (error.code === error.TIMEOUT) {
          setLocationError("Location request timed out.")
        } else {
          setLocationError("Unable to read your current location.")
        }
        setDetectingLocation(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }, [applyLocation])

  return (
    <div className="field-stagger mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        Back to readout
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Settings that stay readable
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Keep every factor available, then tune only the ones you care about.
          If a factor is off, its severity stays out of the way.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="readout-instrument px-5 py-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-foreground">
                <MapPin className="size-3.5" strokeWidth={1.75} />
              </span>
              <h2 className="font-heading text-base font-semibold text-foreground">
                Location
              </h2>
            </div>

            <div className="mb-4 rounded-md border border-border bg-background/60 px-3.5 py-3">
              <p className="font-data text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Current source
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {locationDisplayName(location)}
              </p>
              <p className="font-data mt-0.5 text-xs text-muted-foreground">
                {formatLocationCoordinates(location)}
              </p>
            </div>

            <form onSubmit={applyZipLocation} className="mb-3">
              <label className="mb-1.5 block font-data text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                ZIP code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  placeholder="e.g. 10001"
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 font-data text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/40"
                />
                <Button type="submit" size="sm" disabled={findingZip}>
                  {findingZip ? "\u2026" : "Apply"}
                </Button>
              </div>
            </form>

            <button
              type="button"
              onClick={applyCurrentLocation}
              disabled={detectingLocation}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Navigation className="size-3" strokeWidth={1.75} />
              {detectingLocation ? "Detecting\u2026" : "Use device location"}
            </button>

            {locationNotice && (
              <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
                {locationNotice}
              </p>
            )}
            {locationError && (
              <p className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {locationError}
              </p>
            )}
          </section>

          <section className="readout-instrument px-5 py-4">
            <p className="font-data text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Notes
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Air quality, pollutants, and pollen use a second Open-Meteo request
              when any of those factors are enabled.
            </p>
          </section>
        </aside>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
          {GROUP_ORDER.map((groupKey) => {
            const Icon = GROUP_ICONS[groupKey]
            const groupParams = PARAMS.filter((p) => p.group === groupKey)
            return (
              <section key={groupKey} className="readout-instrument px-5 py-5">
                <div className="mb-4 flex items-start gap-2.5 border-b border-border pb-3">
                  <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-foreground">
                    <Icon className="size-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="flex-1">
                    <h2 className="font-heading text-base font-semibold text-foreground">
                      {PARAM_GROUP_LABELS[groupKey]}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {GROUP_HINTS[groupKey]}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border/70">
                  {groupParams.map((p) => (
                    <ParamRow
                      key={p.id}
                      param={{ ...p, blurb: PARAM_REFERENCE[p.id]?.blurb ?? "" }}
                      enabled={!!flags[p.id]}
                      weightAxes={weightAxesForParam(p.id)}
                      weightValues={weights[p.id]}
                      onToggle={() => updateFlag(p.id, !flags[p.id])}
                      onWeightChange={(axisKey, v) => updateWeight(p.id, axisKey, v)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </section>
      </div>
    </div>
  )
}
