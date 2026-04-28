import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { colors, scoreBandColors, offenderHighlight } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";
import { formatTimeKey12Hour } from "../lib/time";
import { bandForScore } from "../lib/scoreBand";

const DETAILS_OFFSET = 93;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function hourSummaryLine(reasons) {
  if (!reasons?.length) return "Quiet hour.";
  return reasons[0];
}

function prioritizedEntries(entries, count) {
  const offenders = entries.filter((e) => e.isOffender);
  const remainder = entries.filter((e) => !e.isOffender);
  return [...offenders, ...remainder].slice(0, count);
}

export function HourRow({ row, readoutEntries, isEven, defaultExpanded = false, hideSummaryTap = false, showYesterdayHint = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const band = bandForScore(row.score);
  const bandColor = band ? scoreBandColors[band] : null;
  const primaryEntries = prioritizedEntries(readoutEntries ?? [], 3);
  const visibleEntries = showAllMetrics ? (readoutEntries ?? []) : primaryEntries;

  const toggle = useCallback(() => {
    if (hideSummaryTap) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, [hideSummaryTap]);

  return (
    <View style={[styles.container, isEven && styles.evenRow, bandColor && { backgroundColor: bandColor.bg }]}>
      {hideSummaryTap ? (
        <View style={styles.summary}>
          <View style={[styles.borderStrip, bandColor && { backgroundColor: bandColor.border }]} />
          <Text style={styles.time}>{formatTimeKey12Hour(row.time)}</Text>
          <Text style={styles.score}>{row.score}</Text>
          <Text style={styles.reasons} numberOfLines={2}>
            {hourSummaryLine(row.reasons)}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={toggle}
          style={styles.summary}
          accessibilityRole="button"
          accessibilityLabel={`Toggle details for ${formatTimeKey12Hour(row.time)}`}
        >
          <View style={[styles.borderStrip, bandColor && { backgroundColor: bandColor.border }]} />
          <Text style={styles.time}>{formatTimeKey12Hour(row.time)}</Text>
          <Text style={styles.score}>{row.score}</Text>
          <Text style={styles.reasons} numberOfLines={2}>
            {hourSummaryLine(row.reasons)}
          </Text>
        </Pressable>
      )}
      {!expanded && row.reasons?.length > 1 ? (
        <Text style={styles.moreReason}>+{row.reasons.length - 1} more signals</Text>
      ) : null}
      {!hideSummaryTap ? (
        <Pressable
          onPress={toggle}
          style={styles.expandCta}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Hide hour details" : "Show hour details"}
        >
          <Text style={styles.expandText}>{expanded ? "Hide details" : "Show details"}</Text>
        </Pressable>
      ) : null}
      {expanded && visibleEntries?.length > 0 && (
        <View style={styles.detail}>
          {visibleEntries.map((entry) => (
            <View
              key={entry.id}
              style={[styles.entryRow, entry.isOffender && styles.offenderRow]}
            >
              <Text style={styles.entryTerm}>{entry.term}</Text>
              <View style={styles.entryValueWrap}>
                <Text style={[styles.entryValue, entry.isOffender && styles.offenderValue]}>
                  {entry.desc}
                </Text>
                {showYesterdayHint && entry.yesterdayLine ? (
                  <Text style={styles.yesterdayHint}>{entry.yesterdayLine}</Text>
                ) : null}
                {showAllMetrics && entry.referenceRange ? (
                  <Text style={styles.entryRef}>Ref: {entry.referenceRange}</Text>
                ) : null}
                {entry.isOffender ? (
                  <Text style={styles.offenderLabel}>
                    Main offender this hour ({Math.round(entry.offenderPct)}% of penalty)
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {readoutEntries?.length > primaryEntries.length ? (
            <Pressable
              onPress={() => setShowAllMetrics((v) => !v)}
              style={styles.moreMetricsBtn}
              accessibilityRole="button"
              accessibilityLabel={showAllMetrics ? "Show key metrics only" : "Show all metrics"}
            >
              <Text style={styles.moreMetricsText}>
                {showAllMetrics
                  ? "Show key metrics only"
                  : `Show all metrics (${readoutEntries.length})`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  evenRow: {
    backgroundColor: "rgba(232, 228, 216, 0.1)",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 12,
    gap: 10,
  },
  borderStrip: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  time: {
    fontFamily: fontFamilies.data,
    fontSize: 14,
    color: colors.foreground,
    width: 72,
    marginLeft: 8,
  },
  score: {
    fontFamily: fontFamilies.dataSemiBold,
    fontSize: 14,
    color: colors.foreground,
    width: 32,
    textAlign: "center",
  },
  reasons: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 18,
  },
  moreReason: {
    marginTop: -6,
    marginLeft: DETAILS_OFFSET,
    marginBottom: 6,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  expandCta: {
    marginTop: -3,
    marginLeft: DETAILS_OFFSET,
    marginBottom: 10,
  },
  expandText: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    color: colors.foreground,
  },
  detail: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderEmphasis,
    backgroundColor: colors.surfaceCardMuted,
  },
  entryRow: {
    flexDirection: "row",
    paddingVertical: 6,
    gap: 10,
  },
  offenderRow: {
    backgroundColor: offenderHighlight.bg,
    borderLeftWidth: 2,
    borderLeftColor: offenderHighlight.border,
    paddingLeft: 8,
    borderRadius: 4,
    marginVertical: 2,
  },
  entryTerm: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.mutedForeground,
    width: 90,
    paddingTop: 2,
  },
  entryValueWrap: {
    flex: 1,
  },
  entryValue: {
    fontFamily: fontFamilies.data,
    fontSize: 14,
    color: colors.foreground,
  },
  yesterdayHint: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 15,
  },
  offenderValue: {
    fontFamily: fontFamilies.dataSemiBold,
  },
  entryRef: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 15,
  },
  offenderLabel: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    color: offenderHighlight.text,
    marginTop: 2,
    lineHeight: 15,
  },
  moreMetricsBtn: {
    marginTop: 6,
  },
  moreMetricsText: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    color: colors.foreground,
  },
});
