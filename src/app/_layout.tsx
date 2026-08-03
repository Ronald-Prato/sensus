import "../../global.css";

import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SensusProvider } from "../context/SensusProvider";
import { convexClient } from "../lib/convexClient";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexProvider client={convexClient}>
        <SensusProvider>
          <Head>
            <link rel="icon" href="/favicon.ico" sizes="any" />
            <link rel="icon" href="/sensus-logo.svg" type="image/svg+xml" />
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          </Head>
          <Stack screenOptions={{ headerShown: false }} />
        </SensusProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
