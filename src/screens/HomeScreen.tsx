import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Feedback, PaperSurface, ThemeSelector } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import { MAX_TERM_LENGTH, normalizeTermKey } from "../lib/sensus";
import { normalizeTerm, validateTerm } from "../lib/validation";
import type { AppPalette } from "../theme";
import { LibraryContent } from "./LibraryScreen";

const EDGE_SWIPE_WIDTH = 34;
const DRAWER_EXTRA_TRAVEL = 80;
const OPEN_GESTURE_THRESHOLD = 0.22;
const EDGE_SWIPE_ACTIVATION_DISTANCE = 12;
const EDGE_SWIPE_VERTICAL_CANCEL_DISTANCE = 10;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function LibraryIcon({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden style={styles.libraryIcon}>
      <View style={[styles.libraryBook, styles.libraryBookShort, { borderColor: color }]} />
      <View style={[styles.libraryBook, styles.libraryBookTall, { borderColor: color }]} />
      <View style={[styles.libraryBook, styles.libraryBookMedium, { borderColor: color }]} />
      <View style={[styles.libraryBase, { backgroundColor: color }]} />
    </View>
  );
}

function WordProcessingToast({ term, palette, onPress, onDismiss }: { term: string; palette: AppPalette; onPress: () => void; onDismiss: () => void }) {
  const translateY = useSharedValue(140);
  const dismissStarted = useRef(false);

  useEffect(() => {
    dismissStarted.current = false;
    translateY.value = 140;
    translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [term, translateY]);

  const dismiss = () => {
    if (dismissStarted.current) return;
    dismissStarted.current = true;
    translateY.value = withTiming(140, { duration: 210, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  const swipeDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-28, 28])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > 70 || event.velocityY > 900) {
            runOnJS(dismiss)();
            return;
          }
          translateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        }),
    [dismiss, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <GestureDetector gesture={swipeDownGesture}>
      <Animated.View style={[styles.toastLayer, animatedStyle]}>
        <Pressable
          accessibilityLabel={`${term}. Buscando definición. Toca para abrir la biblioteca.`}
          accessibilityRole="button"
          accessibilityState={{ busy: true }}
          onPress={() => {
            dismiss();
            onPress();
          }}
          style={({ pressed }) => [styles.processingToast, { backgroundColor: palette.paperRaised, borderColor: palette.line, opacity: pressed ? 0.82 : 1 }]}
        >
          <View style={styles.toastCopy}>
            <Text numberOfLines={1} style={[styles.toastTerm, { color: palette.ink }]}>{term}</Text>
            <Text style={[styles.toastSubtitle, { color: palette.mutedInk }]}>Buscando definición</Text>
          </View>
          <ActivityIndicator color={palette.accent} size="small" />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const { snapshot, palette, themeMode, isDark, setThemeMode, busyAction, errorMessage, noticeMessage, clearFeedback, addWord } = useSensus();
  const [term, setTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isTermFocused, setIsTermFocused] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [processingToast, setProcessingToast] = useState<{ entryId: string; term: string } | null>(null);
  const drawerProgress = useSharedValue(0);
  const gestureStartProgress = useSharedValue(0);
  const gestureActive = useSharedValue(0);

  const settleDrawer = (open: boolean) => setIsDrawerOpen(open);

  const edgeSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-EDGE_SWIPE_ACTIVATION_DISTANCE, EDGE_SWIPE_ACTIVATION_DISTANCE])
        .failOffsetY([-EDGE_SWIPE_VERTICAL_CANCEL_DISTANCE, EDGE_SWIPE_VERTICAL_CANCEL_DISTANCE])
        .onBegin((event) => {
          const startsAtLeftEdge = event.x <= EDGE_SWIPE_WIDTH;
          const startsAtRightEdge = event.x >= width - EDGE_SWIPE_WIDTH;
          const isClosed = drawerProgress.value <= 0.01;
          const isOpen = drawerProgress.value >= 0.99;

          gestureStartProgress.value = isOpen ? 1 : 0;
          gestureActive.value = (isClosed && startsAtLeftEdge) || (isOpen && startsAtRightEdge) ? 1 : 0;
        })
        .onStart(() => {
          if (gestureActive.value) runOnJS(Keyboard.dismiss)();
        })
        .onUpdate((event) => {
          if (!gestureActive.value) return;

          const drawerTravel = width + DRAWER_EXTRA_TRAVEL;
          drawerProgress.value = clamp(gestureStartProgress.value + event.translationX / drawerTravel, 0, 1);
        })
        .onEnd((event) => {
          if (!gestureActive.value) return;

          const startedClosed = gestureStartProgress.value <= 0.5;
          const shouldOpen = startedClosed
            ? drawerProgress.value > OPEN_GESTURE_THRESHOLD || event.velocityX > 650
            : drawerProgress.value > 1 - OPEN_GESTURE_THRESHOLD && event.velocityX > -650;

          drawerProgress.value = withTiming(shouldOpen ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
          runOnJS(settleDrawer)(shouldOpen);
        })
        .onFinalize((_, success) => {
          const wasEdgeSwipe = gestureActive.value;
          gestureActive.value = 0;
          if (wasEdgeSwipe && !success) {
            drawerProgress.value = withTiming(gestureStartProgress.value, { duration: 220, easing: Easing.out(Easing.cubic) });
          }
        }),
    [drawerProgress, gestureActive, gestureStartProgress, settleDrawer, width],
  );

  const submit = async () => {
    const error = validateTerm(term);
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setIsAdding(true);
    const normalizedTerm = normalizeTerm(term);
    const existingEntry = snapshot.entries.find((entry) => normalizeTermKey(entry.term) === normalizeTermKey(normalizedTerm));
    const result = await addWord(normalizedTerm);
    setIsAdding(false);
    if (result.ok) {
      setTerm("");
      if (!existingEntry && result.entryId) setProcessingToast({ entryId: result.entryId, term: normalizedTerm });
    } else {
      setFormError(result.error);
    }
  };

  useEffect(() => {
    if (!processingToast) return;
    const entry = snapshot.entries.find((candidate) => candidate.id === processingToast.entryId);
    if (!entry || entry.status === "ready" || entry.status === "not-found" || entry.status === "failed") {
      setProcessingToast(null);
    }
  }, [processingToast, snapshot.entries]);

  const openDrawer = () => {
    Keyboard.dismiss();
    setIsDrawerOpen(true);
    drawerProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    clearFeedback();
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    drawerProgress.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  };

  const mainLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerProgress.value * width }],
  }));
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - drawerProgress.value) * width }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value * 0.16,
  }));
  const loading = isAdding || busyAction === "reconcile";

  return (
    <PaperSurface palette={palette}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <GestureDetector gesture={edgeSwipeGesture}>
          <View style={styles.surface}>
            <Animated.View style={[styles.mainLayer, mainLayerStyle]}>
              <View style={styles.screen}>
                <View style={styles.topBar}>
                  <Pressable
                    accessibilityLabel="Abrir biblioteca"
                    accessibilityRole="button"
                    onPress={openDrawer}
                    style={({ pressed }) => [styles.circleButton, { borderColor: palette.line, opacity: pressed ? 0.68 : 1 }]}
                  >
                    <LibraryIcon color={palette.accent} />
                  </Pressable>
                  <Text style={[styles.brand, { color: palette.ink }]}>sensus</Text>
                  <View style={styles.themeSelector}>
                    <ThemeSelector isDark={isDark} onChange={setThemeMode} palette={palette} value={themeMode} />
                  </View>
                </View>

                <View style={[styles.hero, isTermFocused && width <= 600 ? styles.heroWithKeyboard : undefined]}>
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
                      onBlur={() => setIsTermFocused(false)}
                      onFocus={() => {
                        setIsTermFocused(true);
                        clearFeedback();
                      }}
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
            </Animated.View>

            <Animated.View pointerEvents={isDrawerOpen ? "auto" : "none"} style={[styles.backdrop, { backgroundColor: palette.ink }, backdropStyle]}>
              <Pressable accessibilityLabel="Cerrar biblioteca" accessibilityRole="button" onPress={closeDrawer} style={styles.backdropPressable} />
            </Animated.View>

            <Animated.View
              pointerEvents={isDrawerOpen ? "auto" : "none"}
              style={[styles.drawer, { backgroundColor: palette.paper, borderColor: palette.line, width }, drawerStyle]}
            >
              <View pointerEvents="none" style={styles.drawerTexture}>
                <Image
                  accessibilityIgnoresInvertColors
                  resizeMode="repeat"
                  source={palette.textureImage}
                  style={[StyleSheet.absoluteFill, { opacity: palette.textureOpacity }]}
                />
              </View>
              <View style={styles.drawerContent}>
                <LibraryContent embedded onClose={closeDrawer} />
              </View>
            </Animated.View>

            {processingToast ? (
              <WordProcessingToast
                onDismiss={() => setProcessingToast(null)}
                onPress={openDrawer}
                palette={palette}
                term={processingToast.term}
              />
            ) : null}

          </View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  surface: { flex: 1, overflow: "hidden" },
  mainLayer: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 26 },
  topBar: { minHeight: 84, alignItems: "center", justifyContent: "center", position: "relative" },
  brand: { fontSize: 18, fontWeight: "500", letterSpacing: 2.2 },
  circleButton: { position: "absolute", left: 0, width: 42, height: 42, borderWidth: 1, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  themeSelector: { position: "absolute", right: 0 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 120 },
  heroWithKeyboard: { justifyContent: "flex-start", paddingTop: 54, paddingBottom: 20 },
  headline: { fontFamily: "Iowan Old Style", fontSize: 36, lineHeight: 43, fontWeight: "400", letterSpacing: 0.35, textAlign: "center" },
  inputShell: { width: "100%", minHeight: 70, borderWidth: 1, borderRadius: 23, flexDirection: "row", alignItems: "center", marginTop: 31, overflow: "hidden" },
  termInput: { flex: 1, minHeight: 68, paddingHorizontal: 22, paddingVertical: 0, fontSize: 17 },
  submitButton: { width: 69, minHeight: 68, alignItems: "center", justifyContent: "center", borderLeftWidth: 1 },
  submitArrow: { fontSize: 34, lineHeight: 36, fontWeight: "300", marginTop: -3 },
  backdrop: { ...StyleSheet.absoluteFill },
  backdropPressable: { ...StyleSheet.absoluteFill },
  drawer: { position: "absolute", top: 0, left: 0, bottom: 0, borderRightWidth: 1, overflow: "hidden" },
  drawerTexture: { ...StyleSheet.absoluteFill },
  drawerContent: { flex: 1 },
  toastLayer: { position: "absolute", left: 20, right: 20, bottom: 18, zIndex: 30, elevation: 30 },
  processingToast: { minHeight: 70, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 13, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14 },
  toastCopy: { flex: 1, gap: 2 },
  toastTerm: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  toastSubtitle: { fontSize: 13, lineHeight: 18 },
  libraryIcon: { width: 27, height: 24, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3, position: "relative", paddingBottom: 3 },
  libraryBook: { width: 6, borderWidth: 1.7, borderRadius: 2 },
  libraryBookShort: { height: 16 },
  libraryBookTall: { height: 21 },
  libraryBookMedium: { height: 18 },
  libraryBase: { position: "absolute", left: 1, right: 1, bottom: 0, height: 1.7, borderRadius: 99 },
});
