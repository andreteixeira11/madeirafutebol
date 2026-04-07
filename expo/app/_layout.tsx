import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Image } from 'expo-image';
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";
import { APP_LOGO_URL } from '@/constants/branding';
import { OneSignalProvider } from '@/components/providers/OneSignalProvider';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Voltar",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [showLaunchScreen, setShowLaunchScreen] = useState<boolean>(true);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const timeout = setTimeout(() => {
      setShowLaunchScreen(false);
    }, 650);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OneSignalProvider>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="dark" />
          <RootLayoutNav />
          {showLaunchScreen ? (
            <View style={styles.launchScreen} pointerEvents="none">
              <Image source={{ uri: APP_LOGO_URL }} style={styles.launchLogo} contentFit="contain" />
            </View>
          ) : null}
        </GestureHandlerRootView>
      </OneSignalProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  launchScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchLogo: {
    width: 140,
    height: 140,
  },
});
