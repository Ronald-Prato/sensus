import "../../global.css";

import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { SensusProvider } from "../context/SensusProvider";
import { convexClient } from "../lib/convexClient";

export default function RootLayout() {
  return (
    <ConvexProvider client={convexClient}>
      <SensusProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SensusProvider>
    </ConvexProvider>
  );
}
