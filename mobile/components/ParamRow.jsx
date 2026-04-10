import { View, Text, StyleSheet } from "react-native";
import { Toggle } from "./Toggle";
import { WeightPills } from "./WeightPills";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

export function ParamRow({ param, enabled, weightAxes, weightValues, onToggle, onWeightChange }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{param.label}</Text>
          {param.blurb ? <Text style={styles.blurb}>{param.blurb}</Text> : null}
        </View>
        <Toggle active={enabled} onToggle={onToggle} />
      </View>
      {enabled ? (
        <View style={styles.weightSection}>
          {weightAxes.map((axis) => (
            <View key={axis.key} style={styles.axisRow}>
              <Text style={styles.weightLabel}>{axis.label}</Text>
              <WeightPills value={weightValues?.[axis.key] ?? 1} onChange={(v) => onWeightChange(axis.key, v)} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.offHint}>Turn this on to tune severity.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(221, 216, 206, 0.7)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  blurb: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    marginTop: 3,
  },
  weightSection: {
    marginTop: 8,
    gap: 8,
  },
  axisRow: {
    gap: 6,
  },
  weightLabel: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  offHint: {
    marginTop: 8,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.mutedForeground,
  },
});
