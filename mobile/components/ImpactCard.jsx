import { View, Text, StyleSheet } from "react-native";
import { colors, scoreBandColors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

function impactBand(score) {
  if (!Number.isFinite(score)) return "unknown";
  if (score <= 25) return "low";
  if (score <= 50) return "moderate";
  if (score <= 75) return "high";
  return "severe";
}

function impactBandLabel(band) {
  if (band === "low") return "Low";
  if (band === "moderate") return "Moderate";
  if (band === "high") return "High";
  if (band === "severe") return "Severe";
  return "Unknown";
}

export function ImpactCard({ title, score, subtitle, reasons, children }) {
  const band = impactBand(score);
  const bandColor = scoreBandColors[band] || {};

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{title}</Text>
      {score != null ? (
        <View style={styles.body}>
          <View style={[styles.scoreCircle, { backgroundColor: bandColor.bg || colors.muted }]}>
            <Text style={styles.scoreText}>{score}</Text>
          </View>
          <View style={styles.info}>
            <View style={[styles.pill, { backgroundColor: bandColor.pill || colors.muted }]}>
              <Text style={[styles.pillText, { color: bandColor.pillText || colors.mutedForeground }]}>
                {impactBandLabel(band)} outside effect
              </Text>
            </View>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
            {reasons?.length > 0 ? (
              <View style={styles.reasonList}>
                {reasons.slice(0, 3).map((r, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <View style={styles.dot} />
                    <Text style={styles.reasonText}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noSignals}>
                No strong outside signals are elevated right now.
              </Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.placeholder}>{children}</Text>
      )}
    </View>
  );
}

export function DayImpactCard({ rollup }) {
  if (!rollup) return null;
  const band = impactBand(rollup.dayImpactScore);
  const bandColor = scoreBandColors[band] || {};

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        If you go outside today, what is the overall hit?
      </Text>
      <View style={styles.dayBody}>
        <View style={styles.dayScoreRow}>
          <Text style={styles.dayScore}>{rollup.dayImpactScore}</Text>
          <View style={[styles.pill, { backgroundColor: bandColor.pill || colors.muted }]}>
            <Text style={[styles.pillText, { color: bandColor.pillText || colors.mutedForeground }]}>
              {impactBandLabel(band)}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{rollup.impactSummary}</Text>
        <Text style={styles.blend}>
          Blend: mean {rollup.meanScore} + peak {rollup.worstScore}
          {rollup.worst?.time ? ` (${rollup.worst.time.slice(11, 16)})` : ""}.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(253, 252, 249, 0.82)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  heading: {
    fontFamily: fontFamilies.heading,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: colors.mutedForeground,
    marginBottom: 14,
  },
  body: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontFamily: fontFamilies.heading,
    fontSize: 28,
    color: colors.foreground,
  },
  info: {
    flex: 1,
    gap: 8,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: fontFamilies.data,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  reasonList: {
    gap: 6,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  reasonText: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
    flex: 1,
  },
  noSignals: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  placeholder: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  dayBody: {
    gap: 10,
  },
  dayScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  dayScore: {
    fontFamily: fontFamilies.heading,
    fontSize: 36,
    lineHeight: 38,
    color: colors.foreground,
  },
  blend: {
    fontFamily: fontFamilies.data,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
