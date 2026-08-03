import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { OnboardingScreen } from "../screens/OnboardingScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecoveryCodeScreen } from "../screens/RecoveryCodeScreen";
import { useSensus } from "../context/SensusProvider";

export default function IndexScreen() {
  const { hydrated, snapshot, palette, recoveryCodeToShow, needsRecovery } = useSensus();

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.paper }]}>
        <Text style={[styles.loadingTitle, { color: palette.ink }]}>sensus</Text>
        <ActivityIndicator color={palette.accent} style={styles.spinner} />
      </View>
    );
  }

  if (!snapshot.profile || needsRecovery) return <OnboardingScreen initialMode={needsRecovery ? "recover" : "new"} />;
  if (recoveryCodeToShow) return <RecoveryCodeScreen />;
  return <HomeScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 3.1 },
  spinner: { marginTop: 17 },
});
