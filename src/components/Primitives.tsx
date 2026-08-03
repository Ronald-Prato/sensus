import { ActivityIndicator, Image, ImageBackground, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useEffect, type ReactNode } from "react";
import Head from "expo-router/head";

import type { AppPalette } from "../theme";
import type { ThemeMode } from "../lib/sensus";

export function PaperSurface({ children, palette }: { children: ReactNode; palette: AppPalette }) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const textureSource = palette.textureImage;
    const textureUrl =
      typeof textureSource === "object" && textureSource !== null && "uri" in textureSource && typeof textureSource.uri === "string"
        ? textureSource.uri
        : null;
    if (!textureUrl) return;
    const backgroundImage = `url("${textureUrl}")`;
    document.documentElement.style.backgroundColor = palette.paper;
    document.documentElement.style.backgroundImage = backgroundImage;
    document.body.style.backgroundColor = palette.paper;
    document.body.style.backgroundImage = backgroundImage;
  }, [palette.paper, palette.textureImage]);

  return (
    <ImageBackground
      accessibilityIgnoresInvertColors
      imageStyle={[styles.textureImage, { opacity: palette.textureOpacity }]}
      resizeMode="cover"
      source={palette.textureImage}
      style={[styles.paper, { backgroundColor: palette.paper }]}
    >
      <Head>
        <meta name="theme-color" content={palette.paper} />
      </Head>
      <StatusBar barStyle={palette.paper === "#121A22" ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
      <View pointerEvents="none" style={styles.textureOverlay}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={palette.textureImage}
          style={[StyleSheet.absoluteFill, { opacity: Math.min(palette.textureOpacity * 0.34, 0.22) }]}
        />
      </View>
    </ImageBackground>
  );
}

export function PrimaryButton({
  title,
  onPress,
  palette,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  palette: AppPalette;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: palette.accent, opacity: pressed || disabled ? 0.78 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.accentInk} /> : <Text style={[styles.primaryButtonText, { color: palette.accentInk }]}>{title}</Text>}
    </Pressable>
  );
}

export function GhostButton({
  title,
  onPress,
  palette,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  palette: AppPalette;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghostButton,
        { borderColor: palette.line, opacity: pressed || disabled ? 0.58 : 1 },
        style,
      ]}
    >
      <Text style={[styles.ghostButtonText, { color: palette.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function ThemeSelector({ palette, value, isDark, onChange }: { palette: AppPalette; value: ThemeMode; isDark: boolean; onChange: (value: ThemeMode) => void }) {
  const options: Array<{ value: "light" | "dark"; label: string; icon: string }> = [
    { value: "light", label: "Tema claro", icon: "☼" },
    { value: "dark", label: "Tema oscuro", icon: "☾" },
  ];

  return (
    <View accessibilityRole="radiogroup" style={styles.themeOptions}>
      {options.map((option) => {
        const selected = option.value === "dark" ? value === "dark" || (value === "system" && isDark) : value === "light" || (value === "system" && !isDark);
        return (
          <Pressable
            accessibilityLabel={`${option.label}${selected ? ", seleccionado" : ""}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.themeOption,
              { borderColor: palette.line, opacity: pressed ? 0.68 : 1 },
              selected && { backgroundColor: palette.danger, borderColor: palette.danger },
            ]}
          >
            <Text style={[styles.themeOptionText, { color: selected ? palette.accentInk : palette.mutedInk }]}>{option.icon}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Feedback({ palette, error, notice, onDismiss }: { palette: AppPalette; error: string | null; notice: string | null; onDismiss: () => void }) {
  const message = error ?? notice;
  if (!message) return null;
  const color = error ? palette.danger : palette.success;

  return (
    <Pressable accessibilityLabel={`${message}. Toca para cerrar.`} accessibilityRole="alert" onPress={onDismiss} style={[styles.feedback, { borderColor: color }]}>
      <Text style={[styles.feedbackText, { color }]}>{message}</Text>
    </Pressable>
  );
}

export function StatusPill({ label, color, palette }: { label: string; color: string; palette: AppPalette }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

export function ScreenHeader({
  title,
  palette,
  onBack,
  trailing,
}: {
  title: string;
  palette: AppPalette;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityLabel="Volver" accessibilityRole="button" hitSlop={12} onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: palette.ink }]}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
      <Text style={[styles.headerTitle, { color: palette.ink }]}>{title}</Text>
      <View style={styles.headerTrailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { flex: 1, width: "100%", height: "100%", minHeight: "100%", overflow: "hidden" },
  safe: { flex: 1, backgroundColor: "transparent" },
  textureImage: { width: "100%", height: "100%" },
  textureOverlay: { ...StyleSheet.absoluteFill, zIndex: 20 },
  primaryButton: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primaryButtonText: { fontFamily: "System", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  ghostButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  ghostButtonText: { fontSize: 15, fontWeight: "600" },
  themeOptions: { flexDirection: "row", alignItems: "center", gap: 8 },
  themeOption: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 99, borderWidth: 1 },
  themeOptionText: { fontSize: 22, lineHeight: 25, fontWeight: "400" },
  feedback: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  feedbackText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, borderWidth: 1, alignSelf: "flex-start" },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "700" },
  header: { minHeight: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 32, height: 40, justifyContent: "center" },
  backText: { fontFamily: "Iowan Old Style", fontSize: 38, lineHeight: 38 },
  headerTitle: { fontFamily: "Iowan Old Style", fontSize: 19, fontWeight: "700", letterSpacing: 0.2 },
  headerTrailing: { width: 32, alignItems: "flex-end" },
});
