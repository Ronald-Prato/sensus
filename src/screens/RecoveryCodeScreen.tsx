import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { GhostButton, PaperSurface, PrimaryButton } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";

export function RecoveryCodeScreen() {
  const { palette, recoveryCodeToShow, clearRecoveryCode } = useSensus();
  const [copied, setCopied] = useState(false);

  if (!recoveryCodeToShow) return null;

  const copyCode = async () => {
    await Clipboard.setStringAsync(recoveryCodeToShow);
    setCopied(true);
  };

  return (
    <PaperSurface palette={palette}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.brand, { color: palette.ink }]}>sensus</Text>
        <View style={styles.intro}>
          <Text style={[styles.kicker, { color: palette.accent }]}>GUÁRDALO UNA VEZ</Text>
          <Text style={[styles.title, { color: palette.ink }]}>Tu código de recuperación</Text>
          <Text style={[styles.description, { color: palette.mutedInk }]}>Lo necesitarás si borras la app o cambias de iPhone. También lo hemos guardado de forma segura en este dispositivo.</Text>
        </View>

        <View style={[styles.codeCard, { borderColor: palette.line, backgroundColor: palette.paperRaised }]}>
          <Text selectable style={[styles.code, { color: palette.ink }]}>{recoveryCodeToShow}</Text>
        </View>

        <PrimaryButton onPress={() => void copyCode()} palette={palette} title={copied ? "Código copiado" : "Copiar código"} />
        <GhostButton onPress={clearRecoveryCode} palette={palette} style={styles.continueButton} title="Entrar a mi biblioteca" />
      </ScrollView>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 36, justifyContent: "center" },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 3.1 },
  intro: { marginTop: 70, marginBottom: 28 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7, lineHeight: 17 },
  title: { fontFamily: "Iowan Old Style", fontSize: 40, lineHeight: 45, marginTop: 12 },
  description: { fontSize: 16, lineHeight: 24, marginTop: 18 },
  codeCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 22, marginBottom: 14 },
  code: { fontFamily: "Menlo", fontSize: 18, letterSpacing: 1.5, textAlign: "center" },
  continueButton: { marginTop: 12 },
});
