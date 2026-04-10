import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Cloud, Wind, Leaf, MapPin, Navigation } from "lucide-react-native";
import { Button } from "../components/Button";
import { ParamRow } from "../components/ParamRow";
import {
  DEFAULT_FLAGS,
  PARAM_REFERENCE,
  PARAM_GROUP_LABELS,
  PARAMS,
} from "../lib/paramConfig";
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
} from "../lib/paramPreferences";
import { resolveZipToLocation } from "../lib/geocodeZip";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

const GROUP_ORDER = ["weather", "air", "allergens"];

const GROUP_ICONS = {
  weather: Cloud,
  air: Wind,
  allergens: Leaf,
};

const GROUP_HINTS = {
  weather: "Core weather signals that shape comfort and outdoor stress.",
  air: "Turning on any air factor adds an extra air-quality data request.",
  allergens: "Turning on pollen factors adds an extra air-quality data request.",
};

function formatLocationCoordinates(location) {
  const lat = Number(location?.latitude);
  const lon = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }));
  const [weights, setWeights] = useState(() => defaultParamWeights());
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }));
  const [zipInput, setZipInput] = useState("");
  const [locationError, setLocationError] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);
  const [findingZip, setFindingZip] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, w, loc] = await Promise.all([
        loadParamFlags(),
        loadParamWeights(),
        loadLocationPreference(),
      ]);
      setFlags(f);
      setWeights(w);
      setLocation(loc);
      setZipInput(loc.zip || "");
    })();
  }, []);

  const updateFlag = useCallback(async (id, checked) => {
    setFlags((prev) => {
      const next = { ...prev, [id]: checked };
      saveParamFlags(next);
      return next;
    });
  }, []);

  const updateWeight = useCallback(async (id, value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setWeights((prev) => {
      const next = { ...prev, [id]: num };
      saveParamWeights(next);
      return next;
    });
  }, []);

  const applyLocation = useCallback(async (next) => {
    setLocation(next);
    await saveLocationPreference(next);
    if (next?.zip) setZipInput(next.zip);
    setLocationError(null);
  }, []);

  const applyZipLocation = useCallback(async () => {
    setFindingZip(true);
    setLocationNotice(null);
    try {
      const next = await resolveZipToLocation(zipInput);
      await applyLocation(next);
      setLocationNotice(`Saved: ${locationDisplayName(next)}`);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Unable to resolve ZIP code.");
    } finally {
      setFindingZip(false);
    }
  }, [zipInput, applyLocation]);

  const applyCurrentLocation = useCallback(async () => {
    setLocationNotice(null);
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission was denied.");
        setDetectingLocation(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });
      const next = {
        source: "geolocation",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: "Current location",
        zip: "",
      };
      await applyLocation(next);
      setLocationNotice("Saved device coordinates.");
    } catch {
      setLocationError("Unable to read your current location.");
    } finally {
      setDetectingLocation(false);
    }
  }, [applyLocation]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Text style={styles.pageTitle}>Settings that stay readable</Text>
          <Text style={styles.pageSubtitle}>
            Keep every factor available, then tune only the ones you care about.
            If a factor is off, its severity stays out of the way.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.iconCircle}>
              <MapPin size={14} color={colors.foreground} strokeWidth={1.75} />
            </View>
            <Text style={styles.locationTitle}>Location</Text>
          </View>

          <View style={styles.currentLocation}>
            <Text style={styles.currentLabel}>CURRENT SOURCE</Text>
            <Text style={styles.currentValue}>{locationDisplayName(location)}</Text>
            <Text style={styles.currentCoords}>{formatLocationCoordinates(location)}</Text>
          </View>

          <View style={styles.zipRow}>
            <Text style={styles.zipLabel}>ZIP CODE</Text>
            <View style={styles.zipInputRow}>
              <TextInput
                style={styles.zipInput}
                value={zipInput}
                onChangeText={setZipInput}
                placeholder="e.g. 10001"
                placeholderTextColor="rgba(101, 107, 123, 0.5)"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={applyZipLocation}
                autoComplete="postal-code"
              />
              <Button size="sm" onPress={applyZipLocation} disabled={findingZip}>
                {findingZip ? "\u2026" : "Apply"}
              </Button>
            </View>
          </View>

          <Pressable
            onPress={applyCurrentLocation}
            disabled={detectingLocation}
            style={styles.geoButton}
          >
            <Navigation size={12} color={colors.mutedForeground} strokeWidth={1.75} />
            <Text style={[styles.geoText, detectingLocation && { opacity: 0.5 }]}>
              {detectingLocation ? "Detecting\u2026" : "Use device location"}
            </Text>
          </Pressable>

          {locationNotice && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{locationNotice}</Text>
            </View>
          )}
          {locationError && (
            <View style={styles.errorNotice}>
              <Text style={styles.errorNoticeText}>{locationError}</Text>
            </View>
          )}
        </Animated.View>

        {GROUP_ORDER.map((groupKey, gi) => {
          const Icon = GROUP_ICONS[groupKey];
          const groupParams = PARAMS.filter((p) => p.group === groupKey);
          return (
            <Animated.View
              key={groupKey}
              entering={FadeInDown.duration(400).delay(100 + gi * 50)}
              style={styles.groupCard}
            >
              <View style={styles.groupHeader}>
                <View style={styles.iconCircle}>
                  <Icon size={14} color={colors.foreground} strokeWidth={1.75} />
                </View>
                <View style={styles.groupHeaderText}>
                  <Text style={styles.groupTitle}>{PARAM_GROUP_LABELS[groupKey]}</Text>
                  <Text style={styles.groupHint}>{GROUP_HINTS[groupKey]}</Text>
                </View>
              </View>
              {groupParams.map((p) => (
                <ParamRow
                  key={p.id}
                  param={{ ...p, blurb: PARAM_REFERENCE[p.id]?.blurb ?? "" }}
                  enabled={!!flags[p.id]}
                  weight={weights[p.id] ?? 1}
                  onToggle={() => updateFlag(p.id, !flags[p.id])}
                  onWeightChange={(v) => updateWeight(p.id, v)}
                />
              ))}
            </Animated.View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  pageTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 24,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  locationCard: {
    backgroundColor: "rgba(253, 252, 249, 0.82)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  locationTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 16,
    color: colors.foreground,
  },
  currentLocation: {
    backgroundColor: "rgba(245, 243, 238, 0.6)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  currentLabel: {
    fontFamily: fontFamilies.data,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
  currentValue: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 14,
    color: colors.foreground,
    marginTop: 4,
  },
  currentCoords: {
    fontFamily: fontFamilies.data,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  zipRow: {
    gap: 6,
  },
  zipLabel: {
    fontFamily: fontFamilies.data,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
  zipInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  zipInput: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    fontFamily: fontFamilies.data,
    fontSize: 14,
    color: colors.foreground,
  },
  geoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  geoText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  noticeBox: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(156, 68, 34, 0.2)",
    backgroundColor: "rgba(156, 68, 34, 0.05)",
    padding: 10,
  },
  noticeText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.foreground,
  },
  errorNotice: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(160, 42, 24, 0.2)",
    backgroundColor: "rgba(160, 42, 24, 0.05)",
    padding: 10,
  },
  errorNoticeText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.destructive,
  },
  groupCard: {
    backgroundColor: "rgba(253, 252, 249, 0.82)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  groupHeaderText: {
    flex: 1,
  },
  groupTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 16,
    color: colors.foreground,
  },
  groupHint: {
    marginTop: 3,
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
});
