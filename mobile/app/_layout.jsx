import { useFonts, Fraunces_400Regular, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
import { SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold } from "@expo-google-fonts/source-sans-3";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: fontFamilies.heading, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "Outside impact readout", headerShown: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: "Settings", presentation: "card" }}
        />
      </Stack>
    </>
  );
}
