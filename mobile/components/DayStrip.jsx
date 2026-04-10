import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

export function DayStrip({ scored, selectedTime, onSelect }) {
  if (!scored?.length) return null;
  const first = scored[0]?.time?.slice(11, 16) ?? "";
  const mid = scored[Math.floor(scored.length / 2)]?.time?.slice(11, 16) ?? "";
  const last = scored[scored.length - 1]?.time?.slice(11, 16) ?? "";

  return (
    <View>
      <View style={styles.container}>
        {scored.map((r) => (
          <Pressable
            key={r.time}
            onPress={() => onSelect?.(r.time)}
            style={[
              styles.bar,
              { opacity: 0.15 + (r.score / 100) * 0.85 },
              selectedTime === r.time && styles.barSelected,
            ]}
          />
        ))}
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.timeLabel}>{first}</Text>
        <Text style={styles.timeLabel}>{mid}</Text>
        <Text style={styles.timeLabel}>{last}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 16,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 2,
  },
  bar: {
    flex: 1,
    backgroundColor: colors.primary,
    minWidth: 1,
    borderRadius: 2,
  },
  barSelected: {
    borderWidth: 1,
    borderColor: colors.foreground,
  },
  labelRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeLabel: {
    fontFamily: fontFamilies.data,
    fontSize: 10,
    color: colors.mutedForeground,
  },
});
