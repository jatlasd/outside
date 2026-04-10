import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { colors, scoreBandColors, offenderHighlight } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function bandForScore(score) {
  if (!Number.isFinite(score)) return null;
  if (score <= 25) return "low";
  if (score <= 50) return "moderate";
  if (score <= 75) return "high";
  return "severe";
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

export function HourRow({ row, readoutEntries, isEven, defaultExpanded = false, hideSummaryTap = false }) {
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

  useEffect(() => {
    setExpanded(defaultExpanded);
    if (!defaultExpanded) setShowAllMetrics(false);
  }, [defaultExpanded]);

  return (
    <View style={[styles.container, isEven && styles.evenRow, bandColor && { backgroundColor: bandColor.bg }]}>
      <Pressable onPress={toggle} style={styles.summary}>
        <View style={[styles.borderStrip, bandColor && { backgroundColor: bandColor.border }]} />
        <Text style={styles.time}>{row.time.slice(11, 16)}</Text>
        <Text style={styles.score}>{row.score}</Text>
        <Text style={styles.reasons} numberOfLines={2}>
          {hourSummaryLine(row.reasons)}
        </Text>
      </Pressable>
      {!expanded && row.reasons?.length > 1 ? (
        <Text style={styles.moreReason}>+{row.reasons.length - 1} more signals</Text>
      ) : null}
      {!hideSummaryTap ? (
        <Pressable onPress={toggle} style={styles.expandCta}>
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
    width: 52,
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
    marginLeft: 73,
    marginBottom: 6,
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  expandCta: {
    marginTop: -3,
    marginLeft: 73,
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
    borderTopColor: "rgba(221, 216, 206, 0.8)",
    backgroundColor: "rgba(253, 252, 249, 0.4)",
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
