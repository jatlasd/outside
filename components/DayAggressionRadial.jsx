"use client"

import { useEffect, useId, useState } from "react"

function shortLabelFor(full) {
  if (full === "Other") return "Other"
  const t = full.split("(")[0].trim()
  if (t.length <= 22) return t
  return `${t.slice(0, 20)}…`
}

export function DayAggressionRadial({
  nowScore,
  dayImpactScore,
  impactBand,
  breakdown,
  worst,
}) {
  const titleId = useId()
  const descId = useId()
  const listId = useId()
  const [ringReady, setRingReady] = useState(false)

  const items = breakdown?.items ?? []
  const safeDay =
    dayImpactScore != null && Number.isFinite(dayImpactScore)
      ? Math.min(100, Math.max(0, dayImpactScore))
      : worst?.score != null && Number.isFinite(worst.score)
        ? Math.min(100, Math.max(0, worst.score))
        : 0
  const safeNow =
    nowScore != null && Number.isFinite(nowScore)
      ? Math.min(100, Math.max(0, nowScore))
      : null

  const rNow = 34
  const rDay = 48
  const rComp = 64
  const cNow = 2 * Math.PI * rNow
  const cDay = 2 * Math.PI * rDay
  const cComp = 2 * Math.PI * rComp
  const dashOffsetNow = cNow * (1 - (safeNow ?? 0) / 100)
  const dashOffsetDay = cDay * (1 - safeDay / 100)

  useEffect(() => {
    const t = requestAnimationFrame(() => setRingReady(true))
    return () => cancelAnimationFrame(t)
  }, [safeDay, safeNow])

  const compositionArcs = []
  let rotDeg = -90
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const arcLen = (item.pct / 100) * cComp
    const spanDeg = (item.pct / 100) * 360
    const opacity = 0.34 + (i % 5) * 0.12
    compositionArcs.push({
      key: item.id,
      arcLen,
      rotDeg,
      opacity,
      gapLen: cComp - arcLen,
      delayMs: 70 + i * 40,
    })
    rotDeg += spanDeg
  }

  const showBreakdownEmpty = items.length === 0 && safeDay > 0

  return (
    <div className="grid w-full gap-5 md:grid-cols-[minmax(0,252px)_1fr] md:items-start md:gap-6">
      <p id={listId} className="sr-only">
        Factor shares of outside impact today
      </p>
      <ul className="sr-only" aria-labelledby={listId}>
        {items.length ? (
          items.map((item) => (
            <li key={item.id}>
              {shortLabelFor(item.label)}: {Math.round(item.pct)} percent
            </li>
          ))
        ) : (
          <li>No factor breakdown for today.</li>
        )}
      </ul>

      <div className="relative w-full max-w-[252px] justify-self-center md:justify-self-start">
        <svg
          viewBox="-92 -92 184 184"
          className="aspect-square w-full overflow-visible"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>Outside impact readout</title>
          <desc id={descId}>
            Day impact score {safeDay} of 100. Inner ring shows right-now outside
            effect, and outer ring segments show factor shares across the day.
          </desc>
          <circle
            cx="0"
            cy="0"
            r={rComp}
            fill="none"
            stroke="var(--border)"
            strokeWidth="5"
            className="opacity-80"
          />
          {compositionArcs.map((seg) => (
            <circle
              key={seg.key}
              cx="0"
              cy="0"
              r={rComp}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="5"
              strokeLinecap="butt"
              strokeDasharray={`${seg.arcLen} ${seg.gapLen}`}
              opacity={seg.opacity}
              transform={`rotate(${seg.rotDeg} 0 0)`}
              className="readout-segment-enter"
              style={{ animationDelay: `${seg.delayMs}ms` }}
            />
          ))}
          <circle
            cx="0"
            cy="0"
            r={rDay}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
            className="opacity-90"
          />
          <circle
            cx="0"
            cy="0"
            r={rDay}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${cDay} ${cDay}`}
            strokeDashoffset={ringReady ? dashOffsetDay : cDay}
            transform="rotate(-90 0 0)"
            className="radial-ring-progress"
          />
          <circle
            cx="0"
            cy="0"
            r={rNow}
            fill="none"
            stroke="var(--border)"
            strokeWidth="4"
            className="opacity-80"
          />
          {safeNow != null ? (
            <circle
              cx="0"
              cy="0"
              r={rNow}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${cNow} ${cNow}`}
              strokeDashoffset={ringReady ? dashOffsetNow : cNow}
              transform="rotate(-90 0 0)"
              className="radial-ring-progress"
              opacity="0.65"
            />
          ) : null}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          aria-hidden
        >
          <span className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
            {safeDay}
          </span>
          <span className="font-data mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
            day impact
          </span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="font-data rounded border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
            now {safeNow != null ? safeNow : "n/a"}
          </span>
          <span className="font-data rounded border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
            today {safeDay}
          </span>
          {impactBand ? (
            <span className="font-data rounded border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
              {impactBand}
            </span>
          ) : null}
        </div>
        {worst?.time ? (
          <p className="font-data mt-3 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Hardest window{" "}
            <span className="tabular-nums text-foreground">{worst.time.slice(11, 16)}</span>
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-4 border-t border-border pt-4 md:border-t-0 md:border-l md:pl-5 md:pt-0">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            What is driving the day impact
          </p>
          <p className="font-data mt-1 text-[10px] text-muted-foreground sm:text-xs">
            % share of outside impact contributors
          </p>
          {showBreakdownEmpty ? (
            <p className="font-data mt-2 text-xs text-destructive">
              No factor breakdown while score is non-zero—try reloading.
            </p>
          ) : null}
        </div>

        <ul className="space-y-2.5" aria-label="Factor breakdown">
          {items.length ? (
            items.map((item, i) => (
              <li
                key={item.id}
                className="readout-ledger-row-enter"
                style={{ animationDelay: `${120 + i * 42}ms` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-sans text-xs leading-snug text-foreground sm:text-sm">
                    {shortLabelFor(item.label)}
                  </span>
                  <span className="shrink-0 font-data text-xs tabular-nums text-muted-foreground sm:text-sm">
                    <span className="font-medium text-foreground">{Math.round(item.pct)}%</span>
                  </span>
                </div>
                <div
                  className="mt-1 h-1 w-full overflow-hidden bg-border/60"
                  role="presentation"
                >
                  <div
                    className="h-full bg-foreground/35"
                    style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                  />
                </div>
              </li>
            ))
          ) : !showBreakdownEmpty ? (
            <li className="font-data text-xs text-muted-foreground">No raw stress recorded.</li>
          ) : null}
        </ul>

        {worst?.time ? (
          <div className="border-t border-border pt-3">
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Hardest outside hour
            </p>
            <p className="font-data mt-2 text-sm text-foreground">
              <span className="tabular-nums">{worst.time.slice(11, 16)}</span>
              <span className="text-muted-foreground">
                {" "}
                · impact{" "}
                <span className="tabular-nums font-medium text-foreground">{worst.score}</span>
              </span>
            </p>
            {worst.reasons?.length ? (
              <ul className="mt-2 list-inside list-disc space-y-1 font-sans text-xs leading-relaxed text-muted-foreground">
                {worst.reasons.map((r, j) => (
                  <li key={`${j}-${r}`}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
