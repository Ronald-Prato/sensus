import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { useSensus } from "../context/SensusProvider";
import { LibraryScreen } from "../screens/LibraryScreen";

export default function LibraryRoute() {
  const router = useRouter();
  const { hydrated, snapshot } = useSensus();

  useEffect(() => {
    if (hydrated && !snapshot.profile) router.replace("/");
  }, [hydrated, router, snapshot.profile]);

  if (!hydrated || !snapshot.profile) return <View />;
  return <LibraryScreen />;
}
