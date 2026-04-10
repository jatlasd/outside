import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

const CELL_WIDTH = 46;
const BAR_HEIGHT = 40;

export function DayStrip({ scored, selectedTime, onSelect }) {
  if (!scored?.length) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {scored.map((r) => {
          const selected = selectedTime === r.time;
          const opacity = 0.15 + (r.score / 100) * 0.85;
          return (
            <Pressable
              key={r.time}
              onPress={() => onSelect?.(r.time)}
              style={[styles.cell, selected && styles.cellSelected]}
            >
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { opacity, height: BAR_HEIGHT }]} />
              </View>
              <Text style={[styles.cellTime, selected && styles.cellTimeSelected]} numberOfLines={1}>
                {r.time.slice(11, 16)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginHorizontal: -4,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  cell: {
    width: CELL_WIDTH,
    alignItems: "center",
    borderRadius: 8,
    paddingBottom: 6,
    paddingTop: 4,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: colors.foreground,
    backgroundColor: "rgba(232, 228, 216, 0.35)",
  },
  barTrack: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  barFill: {
    width: Math.max(24, CELL_WIDTH - 8),
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cellTime: {
    fontFamily: fontFamilies.data,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  cellTimeSelected: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
  },
});
