import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Feedback, PaperSurface, ThemeSelector } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import { MAX_TERM_LENGTH } from "../lib/sensus";
import { normalizeTerm, validateTerm } from "../lib/validation";
import { LibraryContent } from "./LibraryScreen";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function BookIcon({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden style={styles.bookIcon}>
      <View style={[styles.bookPage, styles.bookPageLeft, { borderColor: color }]} />
      <View style={[styles.bookPage, styles.bookPageRight, { borderColor: color }]} />
      <View style={[styles.bookSpine, { backgroundColor: color }]} />
    </View>
  );
}

export function HomeScreen() {
  const { height } = useWindowDimensions();
  const { palette, themeMode, isDark, setThemeMode, busyAction, errorMessage, noticeMessage, clearFeedback, addWord } = useSensus();
  const [term, setTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerHeight = Math.min(Math.max(height * 0.82, 470), 760);
  const closedOffset = drawerHeight;
  const translateY = useRef(new Animated.Value(closedOffset)).current;
  const dragStart = useRef(closedOffset);

  const animateDrawer = (open: boolean) => {
    Animated.spring(translateY, {
      damping: 23,
      mass: 0.85,
      stiffness: 190,
      toValue: open ? 0 : closedOffset,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    animateDrawer(isDrawerOpen);
  }, [closedOffset, isDrawerOpen]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(clamp(dragStart.current + gesture.dy, 0, closedOffset));
        },
        onPanResponderRelease: (_, gesture) => {
          const position = clamp(dragStart.current + gesture.dy, 0, closedOffset);
          const shouldOpen = gesture.vy < -0.35 || position < closedOffset / 2;
          setIsDrawerOpen(shouldOpen);
        },
        onPanResponderTerminate: () => {
          setIsDrawerOpen(dragStart.current < closedOffset / 2);
        },
      }),
    [closedOffset, translateY],
  );

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

  const openDrawer = () => {
    setIsDrawerOpen(true);
    clearFeedback();
  };

  const closeDrawer = () => setIsDrawerOpen(false);
  const loading = isAdding || busyAction === "reconcile";

  return (
    <PaperSurface palette={palette}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.screen}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="Abrir biblioteca"
              accessibilityRole="button"
              onPress={openDrawer}
              style={({ pressed }) => [styles.circleButton, { borderColor: palette.line, opacity: pressed ? 0.68 : 1 }]}
            >
              <BookIcon color={palette.accent} />
            </Pressable>
            <Text style={[styles.brand, { color: palette.ink }]}>sensus</Text>
            <View style={styles.themeSelector}>
              <ThemeSelector isDark={isDark} onChange={setThemeMode} palette={palette} value={themeMode} />
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={[styles.headline, { color: palette.ink }]}>¿QUÉ PALABRA{`\n`}QUIERES GUARDAR?</Text>
            <View style={[styles.inputShell, { borderColor: palette.line }]}>
              <TextInput
                accessibilityLabel="Escribe una palabra"
                autoCapitalize="sentences"
                autoCorrect={false}
                maxLength={MAX_TERM_LENGTH}
                onChangeText={(value) => {
                  setTerm(value.slice(0, MAX_TERM_LENGTH));
                  setFormError(null);
                  clearFeedback();
                }}
                onFocus={clearFeedback}
                onSubmitEditing={() => void submit()}
                placeholder="Escribe una palabra"
                placeholderTextColor={palette.mutedInk}
                returnKeyType="go"
                style={[styles.termInput, { color: palette.ink }]}
                value={term}
              />
              <Pressable
                accessibilityLabel="Guardar palabra"
                accessibilityRole="button"
                accessibilityState={{ busy: loading, disabled: loading }}
                disabled={loading}
                onPress={() => void submit()}
                style={({ pressed }) => [styles.submitButton, { borderLeftColor: palette.line, opacity: pressed || loading ? 0.58 : 1 }]}
              >
                {loading ? <ActivityIndicator color={palette.accent} /> : <Text style={[styles.submitArrow, { color: palette.accent }]}>→</Text>}
              </Pressable>
            </View>

            {errorMessage || noticeMessage || formError ? (
              <Feedback error={errorMessage ?? formError} notice={noticeMessage} onDismiss={clearFeedback} palette={palette} />
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityLabel="Cerrar biblioteca"
          accessibilityRole="button"
          onPress={closeDrawer}
          pointerEvents={isDrawerOpen ? "auto" : "none"}
          style={[styles.backdrop, { backgroundColor: palette.ink, opacity: isDrawerOpen ? 0.16 : 0 }]}
        />

        <Animated.View
          style={[
            styles.drawer,
            { backgroundColor: palette.paperRaised, borderColor: palette.line, height: drawerHeight },
            { transform: [{ translateY }] },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.drawerHandleZone}>
            <View style={[styles.drawerHandle, { backgroundColor: palette.line }]} />
            <View style={styles.drawerTitleRow}>
              <View style={styles.drawerTitleGroup}>
                <BookIcon color={palette.accent} />
                <Text style={[styles.drawerTitle, { color: palette.ink }]}>Biblioteca</Text>
              </View>
              <Pressable accessibilityLabel="Cerrar biblioteca" accessibilityRole="button" hitSlop={10} onPress={closeDrawer} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: palette.ink }]}>×</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.drawerToolbar}>
            <Text style={[styles.drawerDescription, { color: palette.mutedInk }]}>Tus palabras, listas para volver.</Text>
          </View>

          <View style={styles.drawerBody}>
            <LibraryContent embedded onClose={closeDrawer} />
          </View>
        </Animated.View>

      </KeyboardAvoidingView>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 26 },
  topBar: { minHeight: 84, alignItems: "center", justifyContent: "center", position: "relative" },
  brand: { fontSize: 18, fontWeight: "500", letterSpacing: 2.2 },
  circleButton: { position: "absolute", left: 0, width: 42, height: 42, borderWidth: 1, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  themeSelector: { position: "absolute", right: 0 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 120 },
  headline: { fontFamily: "Iowan Old Style", fontSize: 36, lineHeight: 43, fontWeight: "400", letterSpacing: 0.35, textAlign: "center" },
  inputShell: { width: "100%", minHeight: 70, borderWidth: 1, borderRadius: 23, flexDirection: "row", alignItems: "center", marginTop: 31, overflow: "hidden" },
  termInput: { flex: 1, minHeight: 68, paddingHorizontal: 22, paddingVertical: 0, fontSize: 17 },
  submitButton: { width: 69, minHeight: 68, alignItems: "center", justifyContent: "center", borderLeftWidth: 1 },
  submitArrow: { fontSize: 34, lineHeight: 36, fontWeight: "300", marginTop: -3 },
  backdrop: { ...StyleSheet.absoluteFill },
  drawer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  drawerHandleZone: { paddingTop: 13, paddingHorizontal: 24 },
  drawerHandle: { alignSelf: "center", width: 38, height: 5, borderRadius: 99 },
  drawerTitleRow: { minHeight: 59, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drawerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  drawerTitle: { fontFamily: "Iowan Old Style", fontSize: 25, fontWeight: "700" },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  closeText: { fontFamily: "Iowan Old Style", fontSize: 29, lineHeight: 30, fontWeight: "300" },
  drawerToolbar: { paddingHorizontal: 24, paddingBottom: 14, gap: 13 },
  drawerDescription: { fontSize: 13, lineHeight: 18 },
  drawerBody: { flex: 1 },
  bookIcon: { width: 29, height: 23, flexDirection: "row", position: "relative" },
  bookPage: { width: 14, height: 21, position: "absolute", top: 1, borderWidth: 1.7 },
  bookPageLeft: { left: 0, borderTopLeftRadius: 7, borderBottomLeftRadius: 2, borderRightWidth: 0 },
  bookPageRight: { right: 0, borderTopRightRadius: 7, borderBottomRightRadius: 2, borderLeftWidth: 0 },
  bookSpine: { position: "absolute", left: 13.5, top: 1, width: 1.5, height: 21 },
});
