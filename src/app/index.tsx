import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { HomeScreen } from "../screens/HomeScreen";
import { useSensus } from "../context/SensusProvider";

export default function IndexScreen() {
  const { hydrated, profileReady, palette } = useSensus();

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.paper }]}>
        <Text style={[styles.loadingTitle, { color: palette.ink }]}>sensus</Text>
        <ActivityIndicator color={palette.accent} style={styles.spinner} />
      </View>
    );
  }

  if (!profileReady) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.paper }]}>
        <Text style={[styles.loadingTitle, { color: palette.ink }]}>sensus</Text>
        <ActivityIndicator color={palette.accent} style={styles.spinner} />
      </View>
    );
  }
  return <HomeScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 3.1 },
  spinner: { marginTop: 17 },
});
