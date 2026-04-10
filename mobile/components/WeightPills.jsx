import { View, Pressable, Text, StyleSheet } from "react-native";
import { WEIGHT_LEVEL_OPTIONS } from "../lib/paramPreferences";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

export function WeightPills({ value, onChange }) {
  const displayLabel = (label) => {
    if (label === "Ignore") return "Off";
    if (label === "Standard") return "Std";
    if (label === "Severe") return "Max";
    return label;
  };

  return (
    <View style={styles.container}>
      {WEIGHT_LEVEL_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.label}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
              {displayLabel(opt.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    height: 30,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(253, 252, 249, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillSelected: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  pillText: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.foreground,
  },
  pillTextSelected: {
    color: colors.background,
  },
});
