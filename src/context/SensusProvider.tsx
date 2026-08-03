import { AppState, useColorScheme } from "react-native";
import * as Network from "expo-network";
import {
  useCallback,
  useContext,
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  ACCESS_KEY_KEY,
  buildEntrySearchText,
  createEntryId,
  createMemoryCredentialStore,
  createMemoryLocalStore,
  DEFAULT_NICKNAME,
  EMPTY_SNAPSHOT,
  mergeLibraryEntries,
  normalizeSnapshot,
  normalizeTermKey,
  RECOVERY_CODE_KEY,
  RECOVERY_CODE_PENDING_KEY,
  type EntryStatus,
  type LibraryEntry,
  type LocalSnapshot,
  type SensusRemote,
  type SensusServices,
  type SubmitWordResult,
  type ThemeMode,
} from "../lib/sensus";
import { createConvexRemote } from "../lib/convexRemote";
import { convexClient } from "../lib/convexClient";
import { createNativeLocalStore, createSecureCredentialStore } from "../lib/nativePersistence";
import { normalizeTerm } from "../lib/validation";
import { getPalette, type AppPalette } from "../theme";

interface ActionSuccess {
  ok: true;
  entryId?: string;
}

interface ActionFailure {
  ok: false;
  error: string;
}

export type ActionResult = ActionSuccess | ActionFailure;

export interface SensusContextValue {
  snapshot: LocalSnapshot;
  hydrated: boolean;
  profileReady: boolean;
  palette: AppPalette;
  themeMode: ThemeMode;
  isDark: boolean;
  online: boolean;
  busyAction: string | null;
  errorMessage: string | null;
  noticeMessage: string | null;
  recoveryCodeToShow: string | null;
  needsRecovery: boolean;
  createProfile(nickname: string): Promise<ActionResult>;
  recoverProfile(nickname: string, recoveryCode: string): Promise<ActionResult>;
  addWord(term: string): Promise<ActionResult>;
  submitEntry(entryId: string): Promise<ActionResult>;
  sendPending(): Promise<ActionResult>;
  deleteEntry(entryId: string): Promise<ActionResult>;
  searchEntries(query: string): Promise<LibraryEntry[]>;
  setThemeMode(themeMode: ThemeMode): void;
  clearFeedback(): void;
  clearRecoveryCode(): void;
  refreshAndReconcile(): Promise<void>;
}

const nativeCredentialStore = createSecureCredentialStore();
const defaultServices: Required<Pick<SensusServices, "localStore" | "credentialStore" | "remote" | "getOnlineStatus">> = {
  localStore: createNativeLocalStore(),
  credentialStore: nativeCredentialStore,
  remote: createConvexRemote(convexClient, nativeCredentialStore),
  getOnlineStatus: async () => {
    const state = await Network.getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? false;
  },
};

const testFallbackServices: Required<Pick<SensusServices, "localStore" | "credentialStore">> = {
  localStore: createMemoryLocalStore(),
  credentialStore: createMemoryCredentialStore(),
};

const Context = createContext<SensusContextValue | null>(null);

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("HANDLE_ALREADY_CLAIMED")) return "Ese nickname ya está ocupado. Usa otro o recupera tu biblioteca.";
  if (message.includes("INVALID_RECOVERY_CODE") || message.includes("INVALID_PROFILE_CREDENTIALS")) return "El nickname o código de recuperación no coinciden.";
  if (message.includes("INVALID_HANDLE")) return "Ese nickname no es válido.";
  if (message.includes("INVALID_WORD")) return "Escribe una palabra o expresión más corta.";
  if (message.includes("OPENAI") || message.includes("WORD_PROCESSING")) return "No pudimos procesar la palabra. Puedes reintentarlo.";
  return message || "No pudimos completar la acción. Inténtalo de nuevo.";
}

function isRetryable(status: EntryStatus): boolean {
  return status === "offline-pending" || status === "failed" || status === "not-found";
}

function withRemoteResult(entry: LibraryEntry, result: SubmitWordResult): LibraryEntry {
  const next: LibraryEntry = {
    ...entry,
    status: result.status,
    lastAttemptAt: Date.now(),
  };
  if (result.remoteWordId) next.remoteWordId = result.remoteWordId;
  if (result.details) next.details = result.details;
  else if (result.status === "processing") delete next.details;
  if (result.errorMessage) next.errorMessage = result.errorMessage;
  else delete next.errorMessage;
  return next;
}

export function SensusProvider({ children, services }: PropsWithChildren<{ services?: SensusServices }>) {
  const systemScheme = useColorScheme();
  const resolvedServices = useMemo(
    () => ({
      ...testFallbackServices,
      ...defaultServices,
      ...services,
    }),
    [services],
  );
  const [snapshot, setSnapshot] = useState<LocalSnapshot>(EMPTY_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [recoveryCodeToShow, setRecoveryCodeToShow] = useState<string | null>(null);
  const [credentialsReady, setCredentialsReady] = useState<boolean | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const snapshotRef = useRef(snapshot);
  const reconcileInFlight = useRef<Promise<void> | null>(null);

  const palette = getPalette(snapshot.themeMode, systemScheme);

  const updateSnapshot = useCallback(
    (updater: (current: LocalSnapshot) => LocalSnapshot) => {
      const next = normalizeSnapshot(updater(snapshotRef.current));
      snapshotRef.current = next;
      setSnapshot(next);
      void resolvedServices.localStore.save(next).catch(() => {
        setErrorMessage("No pudimos guardar los cambios en este dispositivo.");
      });
    },
    [resolvedServices.localStore],
  );

  useEffect(() => {
    let active = true;

    void resolvedServices.localStore
      .load()
      .then((storedSnapshot) => {
        if (!active) return;
        const loaded = normalizeSnapshot(storedSnapshot);
        const next = {
          ...loaded,
          profile: loaded.profile?.nickname === DEFAULT_NICKNAME
            ? loaded.profile
            : { nickname: DEFAULT_NICKNAME, createdAt: loaded.profile?.createdAt ?? Date.now() },
        };
        snapshotRef.current = next;
        setSnapshot(next);
      })
      .catch(() => {
        if (active) setErrorMessage("No pudimos leer los datos guardados en este dispositivo.");
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [resolvedServices.localStore]);

  useEffect(() => {
    let active = true;
    if (!resolvedServices.remote?.recoverProfile) {
      setCredentialsReady(true);
      return () => {
        active = false;
      };
    }

    void Promise.all([
      resolvedServices.credentialStore.get(ACCESS_KEY_KEY),
      resolvedServices.credentialStore.get(RECOVERY_CODE_PENDING_KEY),
    ])
      .then(([accessKey, pendingRecoveryCode]) => {
        if (!active) return;
        setCredentialsReady(Boolean(accessKey));
        if (pendingRecoveryCode) setRecoveryCodeToShow(pendingRecoveryCode);
      })
      .catch(() => {
        if (active) setCredentialsReady(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedServices.credentialStore, resolvedServices.remote]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const bootstrapProfile = resolvedServices.remote?.bootstrapProfile;

    if (!bootstrapProfile) {
      setProfileReady(true);
      return () => {
        active = false;
      };
    }

    setProfileReady(false);
    setBusyAction("profile");
    void bootstrapProfile()
      .then((result) => {
        if (!active) return;
        updateSnapshot((previous) => ({
          ...previous,
          profile: result.profile,
          entries: mergeLibraryEntries(previous.entries, result.entries).filter(
            (entry) => !previous.deletedTermKeys.includes(normalizeTermKey(entry.term)),
          ),
        }));
        setCredentialsReady(true);
      })
      .catch(() => {
        if (active) setNoticeMessage("No pudimos conectar con tu biblioteca; reintentaremos cuando haya conexión.");
      })
      .finally(() => {
        if (!active) return;
        setProfileReady(true);
        setBusyAction((current) => (current === "profile" ? null : current));
      });

    return () => {
      active = false;
    };
  }, [hydrated, resolvedServices.remote, updateSnapshot]);

  const submitEntry = useCallback(
    async (entryId: string): Promise<ActionResult> => {
      const current = snapshotRef.current;
      const entry = current.entries.find((candidate) => candidate.id === entryId);
      const remote = resolvedServices.remote;

      if (!entry || !current.profile) return { ok: false, error: "No encontramos esta palabra." };

      if (!online || !remote?.createWord) {
        updateSnapshot((previous) => ({
          ...previous,
          entries: previous.entries.map((candidate) =>
            candidate.id === entryId ? { ...candidate, status: "offline-pending", lastAttemptAt: Date.now() } : candidate,
          ),
        }));
        setNoticeMessage("Quedó guardada y se enviará cuando haya conexión.");
        return { ok: true, entryId };
      }

      updateSnapshot((previous) => ({
        ...previous,
        entries: previous.entries.map((candidate) =>
          candidate.id === entryId
            ? { ...candidate, status: "syncing", errorMessage: undefined, lastAttemptAt: Date.now() }
            : candidate,
        ),
      }));
      setBusyAction(entryId);
      setErrorMessage(null);

      try {
        const result =
          entry.remoteWordId && isRetryable(entry.status) && remote.retryWord
            ? await remote.retryWord({
                nickname: current.profile.nickname,
                entryId,
                term: entry.term,
                remoteWordId: entry.remoteWordId,
              })
            : await remote.createWord({ nickname: current.profile.nickname, entryId, term: entry.term, remoteWordId: entry.remoteWordId });
        if (!snapshotRef.current.entries.some((candidate) => candidate.id === entryId)) {
          const hasLaterSameTerm = snapshotRef.current.entries.some(
            (candidate) =>
              normalizeTermKey(candidate.term) === normalizeTermKey(entry.term) ||
              (result.remoteWordId && candidate.remoteWordId === result.remoteWordId),
          );
          if (!hasLaterSameTerm && result.remoteWordId && remote.deleteWord) {
            try {
              await remote.deleteWord({ nickname: current.profile.nickname, remoteWordId: result.remoteWordId });
            } catch {
              setNoticeMessage("La consulta se eliminó localmente y terminaremos de limpiar la copia remota.");
            }
          }
          return { ok: true, entryId };
        }
        updateSnapshot((previous) => ({
          ...previous,
          entries: previous.entries.map((candidate) => (candidate.id === entryId ? withRemoteResult(candidate, result) : candidate)),
        }));
        return { ok: true, entryId };
      } catch (error) {
        const message = errorText(error);
        updateSnapshot((previous) => ({
          ...previous,
          entries: previous.entries.map((candidate) =>
            candidate.id === entryId ? { ...candidate, status: "failed", errorMessage: message, lastAttemptAt: Date.now() } : candidate,
          ),
        }));
        return { ok: false, error: message };
      } finally {
        setBusyAction((currentBusyAction) => (currentBusyAction === entryId ? null : currentBusyAction));
      }
    },
    [online, resolvedServices.remote, updateSnapshot],
  );

  const reconcileWithStatus = useCallback(
    async (isOnline: boolean) => {
      const current = snapshotRef.current;
      const remote = resolvedServices.remote;
      if (!isOnline || !current.profile || !remote) return;
      if (reconcileInFlight.current) return reconcileInFlight.current;

      const reconcile = (async () => {
        setBusyAction("reconcile");
        try {
          if (remote.reconcile) {
            const entries = await remote.reconcile({
              nickname: current.profile!.nickname,
              entries: current.entries,
              deletedTermKeys: current.deletedTermKeys,
            });
            updateSnapshot((previous) => {
              const deletedTermKeys = new Set(previous.deletedTermKeys);
              return {
                ...previous,
                entries: mergeLibraryEntries(previous.entries, entries).filter(
                  (entry) => !deletedTermKeys.has(normalizeTermKey(entry.term)),
                ),
              };
            });
          } else if (remote.listWords) {
            const remoteEntries = await remote.listWords({ nickname: current.profile!.nickname });
            updateSnapshot((previous) => ({
              ...previous,
              entries: mergeLibraryEntries(previous.entries, remoteEntries),
            }));
          } else {
            for (const entry of current.entries.filter((candidate) => isRetryable(candidate.status))) {
              await submitEntry(entry.id);
            }
          }
        } catch {
          setNoticeMessage("La biblioteca sigue guardada; volveremos a sincronizar después.");
        } finally {
          setBusyAction(null);
          reconcileInFlight.current = null;
        }
      })();

      reconcileInFlight.current = reconcile;
      return reconcile;
    },
    [resolvedServices.remote, submitEntry, updateSnapshot],
  );

  const refreshAndReconcile = useCallback(async () => {
    let nextOnline = true;
    try {
      nextOnline = resolvedServices.getOnlineStatus ? await resolvedServices.getOnlineStatus() : true;
    } catch {
      nextOnline = false;
    }
    setOnline(nextOnline);
    await reconcileWithStatus(nextOnline);
  }, [reconcileWithStatus, resolvedServices.getOnlineStatus]);

  useEffect(() => {
    if (hydrated && profileReady) void refreshAndReconcile();
  }, [hydrated, profileReady, refreshAndReconcile]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshAndReconcile();
    });
    return () => subscription.remove();
  }, [refreshAndReconcile]);

  useEffect(() => {
    if (!hydrated || !profileReady) return;
    const subscription = Network.addNetworkStateListener((state) => {
      const nextOnline = state.isInternetReachable ?? state.isConnected ?? false;
      setOnline(nextOnline);
      if (nextOnline) void reconcileWithStatus(true);
    });
    return () => subscription.remove();
  }, [hydrated, profileReady, reconcileWithStatus]);

  useEffect(() => {
    if (!hydrated || !profileReady || !snapshot.entries.some((entry) => entry.status === "offline-pending" || entry.status === "processing" || entry.status === "syncing")) return;
    const interval = setInterval(() => {
      void refreshAndReconcile();
    }, 8_000);
    return () => clearInterval(interval);
  }, [hydrated, profileReady, refreshAndReconcile, snapshot.entries]);

  const createProfile = useCallback(
    async (nickname: string): Promise<ActionResult> => {
      setBusyAction("profile");
      setErrorMessage(null);
      setNoticeMessage(null);
      try {
        const result = resolvedServices.remote?.registerProfile
          ? await resolvedServices.remote.registerProfile({ nickname })
          : { profile: { nickname, createdAt: Date.now() } };
        updateSnapshot((previous) => ({ ...previous, profile: result.profile }));
        if ("accessKey" in result) {
          await Promise.all([
            resolvedServices.credentialStore.set(ACCESS_KEY_KEY, result.accessKey),
            resolvedServices.credentialStore.set(RECOVERY_CODE_KEY, result.recoveryCode),
            resolvedServices.credentialStore.set(RECOVERY_CODE_PENDING_KEY, result.recoveryCode),
          ]);
          setCredentialsReady(true);
          setNoticeMessage("Tu perfil está listo. Guarda tu código de recuperación.");
          setRecoveryCodeToShow(result.recoveryCode);
        } else {
          setNoticeMessage("Tu nickname quedó guardado en este dispositivo.");
        }
        return { ok: true };
      } catch (error) {
        const message = errorText(error);
        setErrorMessage(message);
        return { ok: false, error: message };
      } finally {
        setBusyAction(null);
      }
    },
    [resolvedServices.credentialStore, resolvedServices.remote, updateSnapshot],
  );

  const recoverProfile = useCallback(
    async (nickname: string, recoveryCode: string): Promise<ActionResult> => {
      if (!resolvedServices.remote?.recoverProfile) {
        const message = "La recuperación necesita conexión con la cuenta de Sensus.";
        setErrorMessage(message);
        return { ok: false, error: message };
      }

      setBusyAction("recovery");
      setErrorMessage(null);
      setNoticeMessage(null);
      try {
        const result = await resolvedServices.remote.recoverProfile({ nickname, recoveryCode });
        updateSnapshot((previous) => {
          const sameProfile = normalizeTermKey(previous.profile?.nickname ?? "") === normalizeTermKey(result.profile.nickname);
          const pendingLocalEntries = sameProfile
            ? previous.entries.filter((entry) => !entry.remoteWordId && entry.status !== "ready")
            : [];
          const deletedTermKeys = new Set(sameProfile ? previous.deletedTermKeys : []);
          return {
            ...previous,
            profile: result.profile,
            entries: mergeLibraryEntries(pendingLocalEntries, result.entries).filter(
              (entry) => !deletedTermKeys.has(normalizeTermKey(entry.term)),
            ),
            deletedTermKeys: sameProfile ? previous.deletedTermKeys : [],
          };
        });
        await Promise.all([
          resolvedServices.credentialStore.set(ACCESS_KEY_KEY, result.accessKey),
          resolvedServices.credentialStore.set(RECOVERY_CODE_KEY, result.recoveryCode),
          resolvedServices.credentialStore.set(RECOVERY_CODE_PENDING_KEY, result.recoveryCode),
        ]);
        setCredentialsReady(true);
        setNoticeMessage("Biblioteca recuperada en este dispositivo.");
        setRecoveryCodeToShow(result.recoveryCode);
        void reconcileWithStatus(true);
        return { ok: true };
      } catch (error) {
        const message = errorText(error);
        setErrorMessage(message);
        return { ok: false, error: message };
      } finally {
        setBusyAction(null);
      }
    },
    [reconcileWithStatus, resolvedServices.credentialStore, resolvedServices.remote, updateSnapshot],
  );

  const addWord = useCallback(
    async (term: string): Promise<ActionResult> => {
      const current = snapshotRef.current;
      if (!current.profile) return { ok: false, error: "Primero crea tu perfil." };

      const normalizedTerm = normalizeTerm(term);
      const existing = current.entries.find((entry) => normalizeTermKey(entry.term) === normalizeTermKey(normalizedTerm));
      if (existing) {
        if (online && isRetryable(existing.status)) void submitEntry(existing.id);
        else setNoticeMessage("Esta palabra ya está en tu biblioteca.");
        return { ok: true, entryId: existing.id };
      }

      const entry: LibraryEntry = {
        id: createEntryId(),
        term: normalizedTerm,
        createdAt: Date.now(),
        status: online && resolvedServices.remote?.createWord ? "syncing" : "offline-pending",
      };
      updateSnapshot((previous) => ({
        ...previous,
        entries: [entry, ...previous.entries],
        deletedTermKeys: previous.deletedTermKeys.filter((key) => key !== normalizeTermKey(entry.term)),
      }));
      if (entry.status === "syncing") void submitEntry(entry.id);
      return { ok: true, entryId: entry.id };
    },
    [online, resolvedServices.remote, submitEntry, updateSnapshot],
  );

  const sendPending = useCallback(async (): Promise<ActionResult> => {
    const pendingIds = snapshotRef.current.entries.filter((entry) => isRetryable(entry.status)).map((entry) => entry.id);
    if (!pendingIds.length) return { ok: true };
    if (!online) {
      setNoticeMessage("Estás sin conexión. Lo pendiente sigue guardado.");
      return { ok: true };
    }
    for (const entryId of pendingIds) await submitEntry(entryId);
    return { ok: true };
  }, [online, submitEntry]);

  const deleteEntry = useCallback(
    async (entryId: string): Promise<ActionResult> => {
      const entry = snapshotRef.current.entries.find((candidate) => candidate.id === entryId);
      const profile = snapshotRef.current.profile;
      if (!entry || !profile) return { ok: false, error: "No encontramos esta palabra." };

      if (entry.remoteWordId) {
        if (!online || !resolvedServices.remote?.deleteWord) {
          const message = "Necesitas conexión para eliminar esta palabra de tu biblioteca.";
          setErrorMessage(message);
          return { ok: false, error: message };
        }
        setBusyAction(entryId);
        try {
          await resolvedServices.remote.deleteWord({ nickname: profile.nickname, remoteWordId: entry.remoteWordId });
        } catch (error) {
          const message = errorText(error);
          if (!message.includes("WORD_NOT_FOUND")) {
            setErrorMessage(message);
            return { ok: false, error: message };
          }
        } finally {
          setBusyAction(null);
        }
      }

      updateSnapshot((previous) => ({
        ...previous,
        entries: previous.entries.filter((candidate) => candidate.id !== entryId),
        deletedTermKeys: Array.from(new Set([...previous.deletedTermKeys, normalizeTermKey(entry.term)])),
      }));
      return { ok: true, entryId };
    },
    [online, resolvedServices.remote, updateSnapshot],
  );

  const searchEntries = useCallback(
    async (query: string): Promise<LibraryEntry[]> => {
      const current = snapshotRef.current;
      const normalizedQuery = normalizeTermKey(query);
      if (!normalizedQuery) return current.entries;

      const localMatches = current.entries.filter((entry) => buildEntrySearchText(entry).includes(normalizedQuery));
      if (!online || !current.profile || !resolvedServices.remote?.searchWords) return localMatches;

      try {
        const remoteEntries = await resolvedServices.remote.searchWords({ nickname: current.profile.nickname, query: normalizedQuery });
        const localOfflineOnly = current.entries.filter(
          (entry) => !entry.remoteWordId && buildEntrySearchText(entry).includes(normalizedQuery),
        );
        return mergeLibraryEntries(localOfflineOnly, remoteEntries);
      } catch {
        setNoticeMessage("Mostramos las coincidencias guardadas en este dispositivo.");
        return localMatches;
      }
    },
    [online, resolvedServices.remote],
  );

  const setThemeMode = useCallback(
    (themeMode: ThemeMode) => updateSnapshot((previous) => ({ ...previous, themeMode })),
    [updateSnapshot],
  );

  const clearFeedback = useCallback(() => {
    setErrorMessage(null);
    setNoticeMessage(null);
  }, []);

  const clearRecoveryCode = useCallback(() => {
    setRecoveryCodeToShow(null);
    void resolvedServices.credentialStore.remove(RECOVERY_CODE_PENDING_KEY);
  }, [resolvedServices.credentialStore]);

  const value = useMemo<SensusContextValue>(
    () => ({
      snapshot,
      hydrated,
      profileReady,
      palette,
      themeMode: snapshot.themeMode,
      isDark: snapshot.themeMode === "dark" || (snapshot.themeMode === "system" && systemScheme === "dark"),
      online,
      busyAction,
      errorMessage,
      noticeMessage,
      recoveryCodeToShow,
      needsRecovery: false,
      createProfile,
      recoverProfile,
      addWord,
      submitEntry,
      sendPending,
      deleteEntry,
      searchEntries,
      setThemeMode,
      clearFeedback,
      clearRecoveryCode,
      refreshAndReconcile,
    }),
    [
      addWord,
      busyAction,
      clearFeedback,
      clearRecoveryCode,
      createProfile,
      deleteEntry,
      errorMessage,
      hydrated,
      noticeMessage,
      credentialsReady,
      recoveryCodeToShow,
      online,
      palette,
      recoverProfile,
      refreshAndReconcile,
      searchEntries,
      sendPending,
      setThemeMode,
      snapshot,
      submitEntry,
      systemScheme,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSensus(): SensusContextValue {
  const context = useContext(Context);
  if (!context) throw new Error("useSensus debe usarse dentro de SensusProvider");
  return context;
}
