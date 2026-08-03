import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Feedback, PaperSurface, PrimaryButton } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import { normalizeNickname, normalizeRecoveryCode, validateNickname } from "../lib/validation";

type OnboardingMode = "new" | "recover";

export function OnboardingScreen({ initialMode = "new" }: { initialMode?: OnboardingMode }) {
  const { palette, themeMode, setThemeMode, busyAction, errorMessage, noticeMessage, clearFeedback, createProfile, recoverProfile } = useSensus();
  const [mode, setMode] = useState<OnboardingMode>(initialMode);
  const [nickname, setNickname] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [nicknameHint, setNicknameHint] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isRecovering = mode === "recover";
  const loading = busyAction === "profile" || busyAction === "recovery";

  const handleNicknameChange = (value: string) => {
    const normalized = normalizeNickname(value);
    setNickname(normalized);
    setNicknameHint(value !== normalized ? "Solo se conservarán letras minúsculas, números y guion bajo." : null);
    setFormError(null);
    clearFeedback();
  };

  const submit = async () => {
    const nicknameError = validateNickname(nickname);
    if (nicknameError) {
      setFormError(nicknameError);
      return;
    }

    if (isRecovering && !normalizeRecoveryCode(recoveryCode)) {
      setFormError("Escribe tu código de recuperación.");
      return;
    }

    setFormError(null);
    if (isRecovering) {
      await recoverProfile(nickname, normalizeRecoveryCode(recoveryCode));
    } else {
      await createProfile(nickname);
    }
  };

  const shownError = formError ?? errorMessage;

  return (
    <PaperSurface palette={palette}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Text style={[styles.brand, { color: palette.ink }]}>sensus</Text>
            <View style={[styles.brandMark, { backgroundColor: palette.accent }]} />
          </View>

          <View style={styles.intro}>
            <Text style={[styles.kicker, { color: palette.accent }]}>UN ARCHIVO PERSONAL DEL LENGUAJE</Text>
            <Text style={[styles.headline, { color: palette.ink }]}>Lo que una palabra despierta en ti.</Text>
            <Text style={[styles.description, { color: palette.mutedInk }]}>Guarda palabras, descubre sus matices y vuelve a ellas cuando quieras.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.paperRaised, borderColor: palette.line }]}>
            <Text style={[styles.cardTitle, { color: palette.ink }]}>{isRecovering ? "Recupera tu biblioteca" : "Crea tu identidad"}</Text>
            <Text style={[styles.cardDescription, { color: palette.mutedInk }]}>
              {isRecovering
                ? "Usa el nickname y el código que guardaste al crear tu cuenta."
                : "Tu @nickname será permanente y te identificará en Sensus."}
            </Text>

            <Text style={[styles.label, { color: palette.mutedInk }]} nativeID="nickname-label">Nickname permanente</Text>
            <View style={[styles.inputShell, { borderColor: shownError ? palette.danger : palette.line, backgroundColor: palette.paper }]}>
              <Text style={[styles.at, { color: palette.accent }]}>@</Text>
              <TextInput
                accessibilityLabel="Nickname permanente"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={24}
                onChangeText={handleNicknameChange}
                onFocus={clearFeedback}
                placeholder="tu_nickname"
                placeholderTextColor={palette.quietInk}
                style={[styles.input, { color: palette.ink }]}
                textContentType="username"
                value={nickname}
              />
            </View>
            <Text style={[styles.helper, { color: palette.quietInk }]}>{nickname.length}/24 · 3 mínimo · solo a-z, 0-9 y _</Text>
            {nicknameHint ? <Text style={[styles.inlineHint, { color: palette.warning }]}>{nicknameHint}</Text> : null}

            {isRecovering ? (
              <>
                <Text style={[styles.label, { color: palette.mutedInk }]} nativeID="recovery-label">Código de recuperación</Text>
                <TextInput
                  accessibilityLabel="Código de recuperación"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setRecoveryCode(value);
                    setFormError(null);
                    clearFeedback();
                  }}
                  onFocus={clearFeedback}
                  placeholder="Pega tu código"
                  placeholderTextColor={palette.quietInk}
                  secureTextEntry
                  style={[styles.codeInput, { borderColor: shownError ? palette.danger : palette.line, backgroundColor: palette.paper, color: palette.ink }]}
                  value={recoveryCode}
                />
              </>
            ) : null}

            {shownError ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{shownError}</Text> : null}
            {noticeMessage ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: palette.success }]}>{noticeMessage}</Text> : null}

            <PrimaryButton
              accessibilityLabel={isRecovering ? "Recuperar biblioteca" : "Continuar con este nickname"}
              disabled={loading}
              loading={loading}
              onPress={() => void submit()}
              palette={palette}
              style={styles.submit}
              title={isRecovering ? "Recuperar biblioteca" : "Entrar a Sensus"}
            />

            {loading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : null}
          </View>

          <Pressable
            accessibilityLabel={isRecovering ? "Volver a crear un perfil" : "Ya tengo un perfil, recuperar biblioteca"}
            accessibilityRole="button"
            onPress={() => {
              setMode(isRecovering ? "new" : "recover");
              setFormError(null);
              clearFeedback();
            }}
            style={styles.recoveryLink}
          >
            <Text style={[styles.recoveryLinkText, { color: palette.accent }]}>{isRecovering ? "Crear un perfil nuevo" : "Ya tengo un perfil · Recuperar"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 36 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 3.1 },
  brandMark: { width: 7, height: 7, borderRadius: 99 },
  intro: { marginTop: 64, marginBottom: 34 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7, lineHeight: 17 },
  headline: { fontFamily: "Iowan Old Style", fontSize: 42, lineHeight: 47, fontWeight: "700", marginTop: 12, maxWidth: 350 },
  description: { fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 340 },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  cardTitle: { fontFamily: "Iowan Old Style", fontSize: 24, lineHeight: 29, fontWeight: "700" },
  cardDescription: { fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8 },
  inputShell: { minHeight: 56, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  at: { fontFamily: "Iowan Old Style", fontSize: 24, fontWeight: "700", marginRight: 5 },
  input: { flex: 1, fontSize: 17, minHeight: 54 },
  helper: { fontSize: 11, marginTop: 7, marginBottom: 20 },
  inlineHint: { fontSize: 12, lineHeight: 17, marginTop: -11, marginBottom: 14 },
  codeInput: { minHeight: 56, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontSize: 16, marginBottom: 9 },
  error: { fontSize: 13, fontWeight: "600", lineHeight: 19, marginBottom: 13 },
  notice: { fontSize: 13, fontWeight: "600", lineHeight: 19, marginBottom: 13 },
  submit: { marginTop: 2 },
  loader: { marginTop: 14 },
  recoveryLink: { alignSelf: "center", paddingVertical: 18, paddingHorizontal: 10 },
  recoveryLinkText: { fontSize: 14, fontWeight: "700" },
});
