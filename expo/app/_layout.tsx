import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Image } from 'expo-image';
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from 'react-native';
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
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void SplashScreen.hideAsync();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1400),
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OneSignalProvider>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="dark" />
          <RootLayoutNav />
          {isVisible ? (
            <Animated.View
              style={[styles.launchScreen, { opacity: splashOpacity }]}
              pointerEvents="none"
            >
              <Animated.View
                style={{
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                }}
              >
                <Image
                  source={{ uri: APP_LOGO_URL }}
                  style={styles.launchLogo}
                  contentFit="contain"
                />
              </Animated.View>
            </Animated.View>
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
    width: 150,
    height: 150,
  },
});
