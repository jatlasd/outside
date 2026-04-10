import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

export function Button({
  onPress,
  disabled,
  children,
  variant = "default",
  size = "default",
  style,
  accessibilityLabel,
  accessibilityHint,
}) {
  const isPrimary = variant === "default";
  const isOutline = variant === "outline";
  const isSmall = size === "sm";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        isSmall && styles.small,
        isPrimary && styles.primary,
        isOutline && styles.outline,
        disabled && styles.disabled,
        pressed && !disabled && (isPrimary ? styles.primaryPressed : styles.outlinePressed),
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSmall && styles.smallText,
          isPrimary && styles.primaryText,
          isOutline && styles.outlineText,
          disabled && styles.disabledText,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlinePressed: {
    backgroundColor: colors.muted,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  smallText: {
    fontSize: 13,
  },
  primaryText: {
    color: colors.primaryForeground,
  },
  outlineText: {
    color: colors.foreground,
  },
  disabledText: {
    opacity: 0.7,
  },
});
