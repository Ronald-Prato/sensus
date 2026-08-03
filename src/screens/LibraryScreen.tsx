import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Drawer } from "react-native-drawer-layout";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Feedback, PaperSurface } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import type { AppPalette } from "../theme";
import type { LibraryEntry } from "../lib/sensus";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(timestamp);
}

function HomeIcon({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden style={styles.homeIcon}>
      <View style={[styles.homeRoof, { borderColor: color }]} />
      <View style={[styles.homeBody, { borderColor: color }]}>
        <View style={[styles.homeDoor, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ProcessingShimmer({ palette, width }: { palette: AppPalette; width: number }) {
  const progress = useSharedValue(-1);
  const bandWidth = Math.max(width * 0.28, 110);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = -1;
    progress.value = withRepeat(withTiming(1, { duration: 1650, easing: Easing.linear }), -1, false);

    return () => cancelAnimation(progress);
  }, [progress, width]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (width + bandWidth + 160) }, { rotate: "16deg" }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.shimmerBand, { backgroundColor: palette.accent, left: -bandWidth, width: bandWidth }, shimmerStyle]} />;
}

function EntryCard({
  entry,
  palette,
  busyAction,
  isDeleteConfirming,
  onOpen,
  onRetry,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  entry: LibraryEntry;
  palette: AppPalette;
  busyAction: string | null;
  isDeleteConfirming: boolean;
  onOpen: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const canRetry = entry.status !== "ready" && entry.status !== "syncing" && entry.status !== "processing";
  const isDeleteBusy = busyAction === entry.id;
  const [cardWidth, setCardWidth] = useState(0);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== cardWidth) setCardWidth(nextWidth);
  };

  return (
    <View onLayout={handleCardLayout} style={[styles.entryCard, { backgroundColor: palette.paperRaised, borderColor: palette.line }]}> 
      <Pressable
        accessibilityLabel={`Ver detalles de ${entry.term}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.entryPreview, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.entryHeader}>
          <View style={styles.entryHeading}>
            <Text style={[styles.term, { color: palette.ink }]}>{entry.term}</Text>
            <Text style={[styles.date, { color: palette.quietInk }]}>{formatDate(entry.createdAt)}</Text>
          </View>
        </View>

        {entry.status === "ready" && entry.details?.definitions.length ? (
          <View style={[styles.details, { borderTopColor: palette.line }]}> 
            {entry.details.definitions.slice(0, 1).map((definition, index) => (
              <View key={`${entry.id}-definition-${index}`} style={styles.definition}>
                <Text style={[styles.definitionIndex, { color: palette.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.definitionCopy}>
                  <Text style={[styles.definitionText, { color: palette.ink }]}>{definition.definition}</Text>
                  <Text style={[styles.example, { color: palette.mutedInk }]}>“{definition.example}”</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.statusDescription, { color: palette.mutedInk }]}> 
            {entry.status === "processing" ? "Estamos preparando un resumen claro." : entry.status === "not-found" ? "No encontramos un sentido confiable para esta consulta." : entry.status === "failed" ? entry.errorMessage ?? "Puedes volver a intentarlo." : entry.status === "offline-pending" ? "Se enviará automáticamente al recuperar conexión." : "Estamos enviando tu consulta."}
          </Text>
        )}
      </Pressable>

      {isDeleteConfirming ? (
        <View style={[styles.deleteConfirmation, { borderTopColor: palette.line }]}> 
          <Text style={[styles.deleteConfirmationText, { color: palette.ink }]}>¿Eliminar “{entry.term}”?</Text>
          <View style={styles.deleteConfirmationActions}>
            <Pressable
              accessibilityLabel={`Conservar ${entry.term}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDeleteBusy }}
              disabled={isDeleteBusy}
              onPress={onCancelDelete}
              style={({ pressed }) => [styles.confirmationIcon, { borderColor: palette.line, opacity: pressed || isDeleteBusy ? 0.5 : 1 }]}
            >
              <Text style={[styles.rejectIcon, { color: palette.mutedInk }]}>×</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Confirmar eliminación de ${entry.term}`}
              accessibilityRole="button"
              accessibilityState={{ busy: isDeleteBusy, disabled: isDeleteBusy }}
              disabled={isDeleteBusy}
              onPress={onConfirmDelete}
              style={({ pressed }) => [styles.confirmationIcon, { backgroundColor: palette.accent, borderColor: palette.accent, opacity: pressed || isDeleteBusy ? 0.58 : 1 }]}
            >
              <Text style={[styles.confirmIcon, { color: palette.accentInk }]}>✓</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.entryActions}>
          {canRetry ? (
            <Pressable accessibilityLabel={entry.status === "offline-pending" ? `Enviar ahora ${entry.term}` : `Reintentar ${entry.term}`} accessibilityRole="button" disabled={busyAction === entry.id} onPress={onRetry} style={[styles.retry, { borderColor: palette.line }]}> 
              <Text style={[styles.retryText, { color: palette.accent }]}>{busyAction === entry.id ? "Enviando…" : entry.status === "offline-pending" ? "Enviar ahora" : "Reintentar"}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel={`Eliminar ${entry.term}`} accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
            <Text style={[styles.deleteText, { color: palette.mutedInk }]}>Eliminar</Text>
          </Pressable>
        </View>
      )}

      {entry.status === "processing" && cardWidth > 0 ? <ProcessingShimmer palette={palette} width={cardWidth} /> : null}
    </View>
  );
}

function WordDetailsDrawer({ entry, palette, onClose }: { entry: LibraryEntry; palette: AppPalette; onClose: () => void }) {
  const definitions = entry.details?.definitions ?? [];

  return (
    <SafeAreaView style={[styles.drawerContent, { backgroundColor: palette.paperRaised }]}>
      <View style={[styles.drawerHeader, { borderBottomColor: palette.line }]}>
        <Text style={[styles.drawerEyebrow, { color: palette.accent }]}>Detalle de palabra</Text>
        <Pressable accessibilityLabel="Cerrar detalles" accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: palette.ink }]}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.drawerScrollContent}>
        <Text style={[styles.drawerTerm, { color: palette.ink }]}>{entry.term}</Text>
        <View style={styles.drawerMeta}>
          <Text style={[styles.drawerDate, { color: palette.quietInk }]}>{formatDate(entry.createdAt)}</Text>
        </View>

        {entry.details?.grammaticalCategory ? (
          <View style={[styles.category, { backgroundColor: palette.paperDeep, borderColor: palette.line }]}>
            <Text style={[styles.categoryLabel, { color: palette.quietInk }]}>Categoría gramatical</Text>
            <Text style={[styles.categoryValue, { color: palette.ink }]}>{entry.details.grammaticalCategory}</Text>
          </View>
        ) : null}

        {definitions.length ? (
          <View style={styles.drawerDefinitions}>
            <Text style={[styles.sectionLabel, { color: palette.quietInk }]}>Definiciones</Text>
            {definitions.map((definition, index) => (
              <View key={`${entry.id}-drawer-definition-${index}`} style={[styles.drawerDefinition, { borderTopColor: palette.line }]}>
                <Text style={[styles.drawerDefinitionIndex, { color: palette.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.definitionCopy}>
                  <Text style={[styles.drawerDefinitionText, { color: palette.ink }]}>{definition.definition}</Text>
                  <Text style={[styles.example, { color: palette.mutedInk }]}>“{definition.example}”</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.drawerStatusDescription, { color: palette.mutedInk }]}>
            {entry.status === "processing" ? "Estamos preparando un resumen claro." : entry.status === "not-found" ? "No encontramos un sentido confiable para esta consulta." : entry.status === "failed" ? entry.errorMessage ?? "Puedes volver a intentarlo." : entry.status === "offline-pending" ? "Se enviará automáticamente al recuperar conexión." : "Estamos enviando tu consulta."}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function LibraryContent({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { snapshot, palette, busyAction, errorMessage, noticeMessage, clearFeedback, submitEntry, deleteEntry, searchEntries } = useSensus();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [visibleEntries, setVisibleEntries] = useState<LibraryEntry[]>(snapshot.entries);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      const query = searchDraft.trim().toLocaleLowerCase();
      setSearch(query);
      void searchEntries(query).then((entries) => {
        if (active) setVisibleEntries(entries);
      });
    }, 260);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [searchDraft, searchEntries, snapshot.entries]);

  useEffect(() => {
    if (!search) setVisibleEntries(snapshot.entries);
  }, [search, snapshot.entries]);

  const selectedEntry = selectedEntryId
    ? visibleEntries.find((entry) => entry.id === selectedEntryId) ?? snapshot.entries.find((entry) => entry.id === selectedEntryId) ?? null
    : null;

  const executeDelete = async (entryId: string) => {
    const result = await deleteEntry(entryId);
    if (result.ok) setPendingDeleteId(null);
  };

  const closeLibrary = onClose ?? (() => router.back());

  return (
    <Drawer
      drawerPosition="right"
      drawerStyle={[styles.drawer, { backgroundColor: palette.paperRaised, width: Math.min(360, Math.max(windowWidth - 28, 280)) }]}
      onClose={() => setSelectedEntryId(null)}
      onOpen={() => undefined}
      open={selectedEntry !== null}
      overlayAccessibilityLabel="Cerrar detalles"
      renderDrawerContent={() => (selectedEntry ? <WordDetailsDrawer entry={selectedEntry} onClose={() => setSelectedEntryId(null)} palette={palette} /> : <View />)}
      swipeEnabled={selectedEntry !== null}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, embedded ? styles.embeddedScroll : undefined]}
      >
        <Feedback error={errorMessage} notice={noticeMessage} onDismiss={clearFeedback} palette={palette} />

        <View style={styles.libraryHeader}>
          <Text style={[styles.libraryTitle, { color: palette.ink }]}>Biblioteca</Text>
          <Pressable
            accessibilityLabel={embedded ? "Cerrar biblioteca" : "Volver al inicio"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={closeLibrary}
            style={({ pressed }) => [styles.homeCircleButton, { borderColor: palette.line, opacity: pressed ? 0.68 : 1 }]}
          >
            <HomeIcon color={palette.accent} />
          </Pressable>
        </View>

        <TextInput
          accessibilityLabel="Buscar en la biblioteca"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchDraft}
          placeholder="Buscar en tu biblioteca"
          placeholderTextColor={palette.quietInk}
          style={[styles.searchInput, { borderColor: palette.line, backgroundColor: palette.paperRaised, color: palette.ink }]}
          value={searchDraft}
        />

        <View style={styles.list}>
          {visibleEntries.length ? visibleEntries.map((entry) => (
            <EntryCard
              busyAction={busyAction}
              entry={entry}
              isDeleteConfirming={pendingDeleteId === entry.id}
              key={entry.id}
              onCancelDelete={() => setPendingDeleteId(null)}
              onConfirmDelete={() => void executeDelete(entry.id)}
              onDelete={() => setPendingDeleteId(entry.id)}
              onOpen={() => setSelectedEntryId(entry.id)}
              onRetry={() => void submitEntry(entry.id)}
              palette={palette}
            />
          )) : (
            <View style={[styles.empty, { borderColor: palette.line }]}>
              <Text style={[styles.emptyMark, { color: palette.accent }]}>∅</Text>
              <Text style={[styles.emptyTitle, { color: palette.ink }]}>{search ? "No hay coincidencias" : "Tu biblioteca está vacía"}</Text>
              <Text style={[styles.emptyDescription, { color: palette.mutedInk }]}>{search ? "Prueba con otra palabra o expresión." : "Empieza guardando una palabra desde el inicio."}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Drawer>
  );
}

export function LibraryScreen() {
  const { palette } = useSensus();

  return (
    <PaperSurface palette={palette}>
      <LibraryContent />
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  embeddedScroll: { flex: 1 },
  drawer: { width: 360 },
  drawerContent: { flex: 1 },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 13, paddingBottom: 14, borderBottomWidth: 1 },
  drawerEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 16, fontWeight: "500" },
  drawerScrollContent: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 35 },
  drawerTerm: { fontFamily: "Iowan Old Style", fontSize: 39, lineHeight: 45, fontWeight: "700" },
  drawerMeta: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 13 },
  drawerDate: { fontSize: 12 },
  category: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, marginTop: 25 },
  categoryLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  categoryValue: { fontFamily: "Iowan Old Style", fontSize: 17, fontWeight: "700", marginTop: 3 },
  drawerDefinitions: { marginTop: 28 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  drawerDefinition: { flexDirection: "row", gap: 11, borderTopWidth: 1, paddingTop: 15, marginTop: 13 },
  drawerDefinitionIndex: { fontSize: 11, fontWeight: "800", paddingTop: 3 },
  drawerDefinitionText: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  drawerStatusDescription: { fontSize: 15, lineHeight: 22, marginTop: 28 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34, backgroundColor: "transparent" },
  libraryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  libraryTitle: { fontFamily: "Iowan Old Style", fontSize: 34, lineHeight: 40, fontWeight: "700" },
  homeCircleButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  homeIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "flex-end", position: "relative", paddingTop: 5 },
  homeRoof: { position: "absolute", top: 1, width: 14, height: 14, borderTopWidth: 1.8, borderLeftWidth: 1.8, transform: [{ rotate: "45deg" }] },
  homeBody: { width: 17, height: 13, borderWidth: 1.8, borderTopWidth: 0, alignItems: "center", justifyContent: "flex-end" },
  homeDoor: { width: 4, height: 7, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  searchInput: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15, marginBottom: 15 },
  list: { gap: 13 },
  entryCard: { borderWidth: 1, borderRadius: 18, padding: 15, overflow: "hidden" },
  entryPreview: { borderRadius: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  entryHeading: { flex: 1 },
  term: { fontFamily: "Iowan Old Style", fontSize: 23, lineHeight: 27, fontWeight: "700" },
  date: { fontSize: 11, marginTop: 5 },
  statusDescription: { fontSize: 13, lineHeight: 19, marginTop: 16 },
  details: { borderTopWidth: 1, marginTop: 15, paddingTop: 13, gap: 13 },
  definition: { flexDirection: "row", gap: 10 },
  definitionIndex: { fontSize: 11, fontWeight: "800", paddingTop: 2 },
  definitionCopy: { flex: 1, gap: 4 },
  definitionText: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  example: { fontFamily: "Iowan Old Style", fontSize: 13, lineHeight: 18, fontStyle: "italic" },
  entryActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 15, marginTop: 16 },
  retry: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, justifyContent: "center" },
  retryText: { fontSize: 12, fontWeight: "800" },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 2 },
  deleteText: { fontSize: 12, fontWeight: "600" },
  deleteConfirmation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, marginTop: 16, paddingTop: 12 },
  deleteConfirmationText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  deleteConfirmationActions: { flexDirection: "row", gap: 8 },
  confirmationIcon: { width: 34, height: 34, borderWidth: 1, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  rejectIcon: { fontSize: 24, lineHeight: 25, fontWeight: "300", marginTop: -2 },
  confirmIcon: { fontSize: 18, lineHeight: 20, fontWeight: "800", marginTop: -1 },
  shimmerBand: { position: "absolute", top: -100, bottom: -100, opacity: 0.14 },
  empty: { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 18, paddingHorizontal: 25, paddingVertical: 34 },
  emptyMark: { fontFamily: "Iowan Old Style", fontSize: 32 },
  emptyTitle: { fontFamily: "Iowan Old Style", fontSize: 21, fontWeight: "700", marginTop: 8 },
  emptyDescription: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
});
