import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { Feedback, GhostButton, PaperSurface, StatusPill } from "../components/Primitives";
import { useSensus } from "../context/SensusProvider";
import type { AppPalette } from "../theme";
import type { EntryStatus, LibraryEntry } from "../lib/sensus";

const statusCopy: Record<EntryStatus, { label: string; colorKey: "warning" | "accent" | "success" | "danger" }> = {
  "offline-pending": { label: "Pendiente sin conexión", colorKey: "warning" },
  syncing: { label: "Enviando", colorKey: "accent" },
  processing: { label: "Procesando", colorKey: "accent" },
  ready: { label: "Listo", colorKey: "success" },
  "not-found": { label: "Sin resultado", colorKey: "warning" },
  failed: { label: "No se pudo enviar", colorKey: "danger" },
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(timestamp);
}

function EntryCard({ entry, palette, busyAction, onRetry, onDelete }: { entry: LibraryEntry; palette: AppPalette; busyAction: string | null; onRetry: () => void; onDelete: () => void }) {
  const status = statusCopy[entry.status];
  const color = palette[status.colorKey];
  const canRetry = entry.status !== "ready" && entry.status !== "syncing" && entry.status !== "processing";

  return (
    <View style={[styles.entryCard, { backgroundColor: palette.paperRaised, borderColor: palette.line }]}>
      <View style={styles.entryHeader}>
        <View style={styles.entryHeading}>
          <Text style={[styles.term, { color: palette.ink }]}>{entry.term}</Text>
          <Text style={[styles.date, { color: palette.quietInk }]}>{formatDate(entry.createdAt)}</Text>
        </View>
        <StatusPill color={color} label={status.label} palette={palette} />
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
    </View>
  );
}

export function LibraryContent({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { snapshot, palette, busyAction, errorMessage, noticeMessage, clearFeedback, submitEntry, deleteEntry, searchEntries } = useSensus();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [visibleEntries, setVisibleEntries] = useState<LibraryEntry[]>(snapshot.entries);

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
  const confirmDelete = (entry: LibraryEntry) => {
    Alert.alert("Eliminar consulta", `¿Quieres eliminar “${entry.term}” de tu biblioteca?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => void deleteEntry(entry.id) },
    ]);
  };

  const closeLibrary = onClose ?? (() => router.back());

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={embedded ? styles.embeddedScroll : undefined}>
      <Feedback error={errorMessage} notice={noticeMessage} onDismiss={clearFeedback} palette={palette} />

      <View style={styles.libraryHeader}>
        <Text style={[styles.libraryTitle, { color: palette.ink }]}>Biblioteca</Text>
        <Pressable
          accessibilityLabel="Volver al inicio"
          accessibilityRole="button"
          hitSlop={8}
          onPress={closeLibrary}
          style={({ pressed }) => [styles.homeCircleButton, { borderColor: palette.line, opacity: pressed ? 0.68 : 1 }]}
        >
          <Text style={[styles.homeCircleIcon, { color: palette.accent }]}>⌂</Text>
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
            <EntryCard busyAction={busyAction} entry={entry} key={entry.id} onDelete={() => confirmDelete(entry)} onRetry={() => void submitEntry(entry.id)} palette={palette} />
          )) : (
            <View style={[styles.empty, { borderColor: palette.line }]}>
              <Text style={[styles.emptyMark, { color: palette.accent }]}>∅</Text>
              <Text style={[styles.emptyTitle, { color: palette.ink }]}>{search ? "No hay coincidencias" : "Tu biblioteca está vacía"}</Text>
              <Text style={[styles.emptyDescription, { color: palette.mutedInk }]}>{search ? "Prueba con otra palabra o expresión." : "Empieza guardando una palabra desde el inicio."}</Text>
            </View>
          )}
        </View>
        <GhostButton onPress={closeLibrary} palette={palette} style={styles.homeButton} title="Volver al inicio" />
    </ScrollView>
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
  embeddedScroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34 },
  libraryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  libraryTitle: { fontFamily: "Iowan Old Style", fontSize: 34, lineHeight: 40, fontWeight: "700" },
  homeCircleButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  homeCircleIcon: { fontFamily: "Iowan Old Style", fontSize: 24, lineHeight: 26 },
  searchInput: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15, marginBottom: 15 },
  list: { gap: 13 },
  entryCard: { borderWidth: 1, borderRadius: 18, padding: 15 },
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
  empty: { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 18, paddingHorizontal: 25, paddingVertical: 34 },
  emptyMark: { fontFamily: "Iowan Old Style", fontSize: 32 },
  emptyTitle: { fontFamily: "Iowan Old Style", fontSize: 21, fontWeight: "700", marginTop: 8 },
  emptyDescription: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  homeButton: { marginTop: 22 },
});
