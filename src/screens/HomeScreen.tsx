import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Feedback, GhostButton, PaperSurface, PrimaryButton, ThemeSelector } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import { MAX_TERM_LENGTH } from "../lib/sensus";
import { normalizeTerm, validateTerm } from "../lib/validation";

export function HomeScreen() {
  const router = useRouter();
  const { snapshot, palette, themeMode, setThemeMode, online, busyAction, errorMessage, noticeMessage, clearFeedback, addWord } = useSensus();
  const [term, setTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const submit = async () => {
    const error = validateTerm(term);
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setIsAdding(true);
    const result = await addWord(normalizeTerm(term));
    setIsAdding(false);
    if (result.ok) {
      setTerm("");
    } else {
      setFormError(result.error);
    }
  };

  const pendingCount = snapshot.entries.filter((entry) => entry.status === "offline-pending" || entry.status === "failed").length;

  return (
    <PaperSurface palette={palette}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <View>
              <Text style={[styles.brand, { color: palette.ink }]}>sensus</Text>
              <Text style={[styles.identity, { color: palette.mutedInk }]}>@{snapshot.profile?.nickname}</Text>
            </View>
            <View style={styles.connection}>
              <View style={[styles.connectionDot, { backgroundColor: online ? palette.success : palette.warning }]} />
              <Text style={[styles.connectionText, { color: palette.mutedInk }]}>{online ? "En línea" : "Sin conexión"}</Text>
            </View>
          </View>

          <Feedback error={errorMessage ?? formError} notice={noticeMessage} onDismiss={clearFeedback} palette={palette} />

          <View style={styles.hero}>
            <Text style={[styles.kicker, { color: palette.accent }]}>CONSULTA · GUARDA · VUELVE</Text>
            <Text style={[styles.headline, { color: palette.ink }]}>Las palabras también tienen memoria.</Text>
            <Text style={[styles.subtitle, { color: palette.mutedInk }]}>Escribe algo que quieras entender mejor.</Text>
          </View>

          <View style={[styles.searchCard, { backgroundColor: palette.paperRaised, borderColor: palette.line }]}>
            <TextInput
              accessibilityLabel="Palabra o expresión"
              autoCapitalize="sentences"
              autoCorrect={false}
              maxLength={MAX_TERM_LENGTH}
              multiline
              onChangeText={(value) => {
                setTerm(value.slice(0, MAX_TERM_LENGTH));
                setFormError(null);
                clearFeedback();
              }}
              onFocus={clearFeedback}
              onSubmitEditing={() => void submit()}
              placeholder="una palabra o expresión corta"
              placeholderTextColor={palette.quietInk}
              returnKeyType="search"
              style={[styles.termInput, { color: palette.ink }]}
              value={term}
            />
            <View style={styles.termFooter}>
              <Text style={[styles.counter, { color: palette.quietInk }]}>{term.length}/{MAX_TERM_LENGTH}</Text>
              <Text style={[styles.termHint, { color: palette.quietInk }]}>Hasta 64 caracteres</Text>
            </View>
          </View>

          <PrimaryButton
            accessibilityLabel="Guardar palabra en la biblioteca"
            loading={isAdding || busyAction === "reconcile"}
            onPress={() => void submit()}
            palette={palette}
            title="Guardar en mi biblioteca"
          />

          <Pressable accessibilityLabel="Abrir biblioteca" accessibilityRole="button" onPress={() => router.push("/library")} style={[styles.libraryLink, { borderBottomColor: palette.line }]}>
            <View>
              <Text style={[styles.libraryTitle, { color: palette.ink }]}>Biblioteca</Text>
              <Text style={[styles.librarySubtitle, { color: palette.mutedInk }]}>
                {pendingCount ? `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"} · ` : ""}{snapshot.entries.length} registro{snapshot.entries.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Text style={[styles.arrow, { color: palette.accent }]}>→</Text>
          </Pressable>

          <View style={styles.footer}>
            <ThemeSelector onChange={setThemeMode} palette={palette} value={themeMode} />
            <GhostButton onPress={() => router.push("/library")} palette={palette} style={styles.secondaryLibraryButton} title="Ver biblioteca" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28 },
  topBar: { minHeight: 78, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 3.1 },
  identity: { fontSize: 12, marginTop: 5 },
  connection: { flexDirection: "row", alignItems: "center", gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 99 },
  connectionText: { fontSize: 12, fontWeight: "600" },
  hero: { paddingTop: 58, paddingBottom: 31 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  headline: { fontFamily: "Iowan Old Style", fontSize: 43, lineHeight: 48, fontWeight: "700", marginTop: 13 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 17 },
  searchCard: { minHeight: 132, borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 14 },
  termInput: { flex: 1, minHeight: 64, fontFamily: "Iowan Old Style", fontSize: 22, lineHeight: 28, textAlign: "center", paddingVertical: 5 },
  termFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  counter: { fontSize: 11, fontWeight: "700" },
  termHint: { fontSize: 11 },
  libraryLink: { minHeight: 76, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26 },
  libraryTitle: { fontFamily: "Iowan Old Style", fontSize: 22, fontWeight: "700" },
  librarySubtitle: { fontSize: 13, marginTop: 5 },
  arrow: { fontSize: 28, paddingRight: 3 },
  footer: { gap: 24, paddingTop: 30 },
  secondaryLibraryButton: { alignSelf: "flex-start" },
});
