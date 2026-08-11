import { DEFAULT_SPEECH_TO_TEXT_MODEL_ID } from "@/modules/ai/lib/speechToText";
import {
  DEFAULT_CONFIGURED_SPEECH_TO_TEXT_PROVIDER_IDS,
  normalizeSpeechToTextProviderIds,
  type ProviderId,
} from "@/modules/ai/config";
import {
  DEFAULT_EXCLUDED_FOLDER_NAMES,
  normalizeExcludedFolderNames,
} from "@/modules/explorer/lib/excludedFolders";
import {
  DEFAULT_CONFIGURED_CLI_AGENT_IDS,
  normalizeCliAgentIds,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";
import type { KeyBinding, ShortcutId } from "@/modules/shortcuts/shortcuts";
import { DEFAULT_THEME_ID } from "@/modules/theme/constants";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";

export type ThemePref = "system" | "light" | "dark";

export type BackgroundKind = "none" | "image";

export const EDITOR_THEMES = [
  "atomone",
  "aura",
  "copilot",
  "github-dark",
  "github-light",
  "gruvbox-dark",
  "nord",
  "tokyo-night",
  "xcode-dark",
  "xcode-light",
] as const;

export type EditorThemeId = (typeof EDITOR_THEMES)[number];

export const EDITOR_THEME_LABELS: Record<EditorThemeId, string> = {
  atomone: "Atom One",
  aura: "Aura",
  copilot: "Copilot",
  "github-dark": "GitHub Dark",
  "github-light": "GitHub Light",
  "gruvbox-dark": "Gruvbox Dark",
  nord: "Nord",
  "tokyo-night": "Tokyo Night",
  "xcode-dark": "Xcode Dark",
  "xcode-light": "Xcode Light",
};

export type Preferences = {
  theme: ThemePref;
  themeId: string;
  backgroundKind: BackgroundKind;
  backgroundImageId: string | null;
  backgroundOpacity: number;
  backgroundBlur: number;
  canvasBackgroundImageId: string | null;
  editorTheme: EditorThemeId;
  remoteAccessEnabled: boolean;
  autostart: boolean;
  restoreWindowState: boolean;
  speechToTextModelId: string;
  speechToTextProviderIds: ProviderId[];
  disabledSpeechToTextProviderIds: ProviderId[];
  vimMode: boolean;
  showHidden: boolean;
  explorerExcludedFolderNames: string[];
  terminalWebglEnabled: boolean;
  terminalCopyOnSelection: boolean;
  floatingVoiceAgentEnabled: boolean;
  terminalFontFamily: string;
  terminalLetterSpacing: number;
  terminalFontSize: number;
  terminalScrollback: number;
  lastWslDistro: string | null;
  zoomLevel: number;
  shortcuts: Record<ShortcutId, KeyBinding[]>;
  agentLaunchCommands: Record<string, string>;
  cliAgentIds: CliAgent[];
  disabledCliAgentIds: CliAgent[];
};

const STORE_PATH = "cmdspace-settings.json";
const KEY_THEME = "theme";
const KEY_THEME_ID = "themeId";
const KEY_BG_KIND = "backgroundKind";
const KEY_BG_IMAGE_ID = "backgroundImageId";
const KEY_BG_OPACITY = "backgroundOpacity";
const KEY_BG_BLUR = "backgroundBlur";
const KEY_CANVAS_BG_IMAGE_ID = "canvasBackgroundImageId";
const KEY_EDITOR_THEME = "editorTheme";
const KEY_REMOTE_ACCESS_ENABLED = "remoteAccessEnabled";
const KEY_AUTOSTART = "autostart";
const KEY_RESTORE_WINDOW = "restoreWindowState";
const KEY_SPEECH_TO_TEXT_MODEL = "speechToTextModelId";
const KEY_SPEECH_TO_TEXT_PROVIDERS = "speechToTextProviderIds";
const KEY_DISABLED_SPEECH_TO_TEXT_PROVIDERS =
  "disabledSpeechToTextProviderIds";
const KEY_VIM_MODE = "vimMode";
const KEY_SHOW_HIDDEN = "showHidden";
const LEGACY_KEY_SHOW_HIDDEN_DIRS = "showHiddenDirectories";
const KEY_EXPLORER_EXCLUDED_FOLDER_NAMES = "explorerExcludedFolderNames";
const KEY_TERMINAL_WEBGL_ENABLED = "terminalWebglEnabled";
const KEY_TERMINAL_COPY_ON_SELECTION = "terminalCopyOnSelection";
const KEY_FLOATING_VOICE_AGENT_ENABLED = "floatingVoiceAgentEnabled";
const KEY_TERMINAL_FONT_FAMILY = "terminalFontFamily";
const KEY_TERMINAL_LETTER_SPACING = "terminalLetterSpacing";
const KEY_TERMINAL_FONT_SIZE = "terminalFontSize";
const KEY_TERMINAL_SCROLLBACK = "terminalScrollback";
const KEY_LAST_WSL_DISTRO = "lastWslDistro";
const KEY_ZOOM_LEVEL = "zoomLevel";
const KEY_SHORTCUTS = "shortcuts";
const KEY_AGENT_LAUNCH_COMMANDS = "agentLaunchCommands";
const KEY_CLI_AGENT_IDS = "cliAgentIds";
const KEY_DISABLED_CLI_AGENT_IDS = "disabledCliAgentIds";

export const TERMINAL_FONT_SIZE_DEFAULT = 14;
export const TERMINAL_FONT_SIZE_MIN = 8;
export const TERMINAL_FONT_SIZE_MAX = 32;

export const TERMINAL_FONT_SIZES = [
  10, 12, 13, 14, 15, 16, 18, 20, 22, 24,
] as const;

export const TERMINAL_SCROLLBACK_DEFAULT = 2000;
export const TERMINAL_SCROLLBACK_MIN = 200;
export const TERMINAL_SCROLLBACK_MAX = 50_000;
export const TERMINAL_SCROLLBACK_PRESETS = [
  500, 1000, 2000, 5000, 10_000, 25_000,
] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  themeId: DEFAULT_THEME_ID,
  backgroundKind: "none",
  backgroundImageId: null,
  backgroundOpacity: 0.5,
  backgroundBlur: 0,
  canvasBackgroundImageId: null,
  editorTheme: "atomone",
  remoteAccessEnabled: false,
  autostart: false,
  restoreWindowState: true,
  speechToTextModelId: DEFAULT_SPEECH_TO_TEXT_MODEL_ID,
  speechToTextProviderIds: [...DEFAULT_CONFIGURED_SPEECH_TO_TEXT_PROVIDER_IDS],
  disabledSpeechToTextProviderIds: [],
  vimMode: false,
  showHidden: false,
  explorerExcludedFolderNames: [...DEFAULT_EXCLUDED_FOLDER_NAMES],
  terminalWebglEnabled: false,
  terminalCopyOnSelection: false,
  floatingVoiceAgentEnabled: false,
  terminalFontFamily: "",
  terminalLetterSpacing: 0,
  terminalFontSize: TERMINAL_FONT_SIZE_DEFAULT,
  terminalScrollback: TERMINAL_SCROLLBACK_DEFAULT,
  lastWslDistro: null,
  zoomLevel: 1.0,
  shortcuts: {} as Record<ShortcutId, KeyBinding[]>,
  agentLaunchCommands: {},
  cliAgentIds: [...DEFAULT_CONFIGURED_CLI_AGENT_IDS],
  disabledCliAgentIds: [],
};

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

// LazyStore.onChange only fires within the writing process. The settings
// page lives in a separate webview, so writes there never reach the main
// window's subscribers. Mirror every setter through a Tauri event so any
// window can listen.
const PREFS_CHANGED_EVENT = "cmdspace://prefs-changed";

async function writePref<T>(key: string, value: T): Promise<void> {
  await store.set(key, value);
  await store.save();
  await emit(PREFS_CHANGED_EVENT, { key, value });
}

export async function loadPreferences(): Promise<Preferences> {
  // Single IPC roundtrip — fetching keys individually fans out to one
  // `plugin:store|get` per setting and is the dominant boot cost.
  const entries = await store.entries();
  const map = new Map<string, unknown>(entries);
  const get = <T>(k: string): T | undefined => map.get(k) as T | undefined;
  return {
    theme: get<ThemePref>(KEY_THEME) ?? DEFAULT_PREFERENCES.theme,
    themeId: get<string>(KEY_THEME_ID) ?? DEFAULT_PREFERENCES.themeId,
    backgroundKind:
      get<BackgroundKind>(KEY_BG_KIND) ?? DEFAULT_PREFERENCES.backgroundKind,
    backgroundImageId:
      get<string | null>(KEY_BG_IMAGE_ID) ??
      DEFAULT_PREFERENCES.backgroundImageId,
    backgroundOpacity: clampBgOpacity(
      get<number>(KEY_BG_OPACITY) ?? DEFAULT_PREFERENCES.backgroundOpacity,
    ),
    backgroundBlur: clampBlur(
      get<number>(KEY_BG_BLUR) ?? DEFAULT_PREFERENCES.backgroundBlur,
    ),
    canvasBackgroundImageId:
      get<string | null>(KEY_CANVAS_BG_IMAGE_ID) ??
      DEFAULT_PREFERENCES.canvasBackgroundImageId,
    editorTheme:
      get<EditorThemeId>(KEY_EDITOR_THEME) ?? DEFAULT_PREFERENCES.editorTheme,
    remoteAccessEnabled:
      get<boolean>(KEY_REMOTE_ACCESS_ENABLED) ??
      DEFAULT_PREFERENCES.remoteAccessEnabled,
    autostart: get<boolean>(KEY_AUTOSTART) ?? DEFAULT_PREFERENCES.autostart,
    restoreWindowState:
      get<boolean>(KEY_RESTORE_WINDOW) ??
      DEFAULT_PREFERENCES.restoreWindowState,
    speechToTextModelId:
      get<string>(KEY_SPEECH_TO_TEXT_MODEL) ??
      DEFAULT_PREFERENCES.speechToTextModelId,
    speechToTextProviderIds: normalizeSpeechToTextProviderIds(
      get<string[]>(KEY_SPEECH_TO_TEXT_PROVIDERS) ??
        DEFAULT_PREFERENCES.speechToTextProviderIds,
    ),
    disabledSpeechToTextProviderIds: normalizeSpeechToTextProviderIds(
      get<string[]>(KEY_DISABLED_SPEECH_TO_TEXT_PROVIDERS) ??
        DEFAULT_PREFERENCES.disabledSpeechToTextProviderIds,
    ),
    vimMode: get<boolean>(KEY_VIM_MODE) ?? DEFAULT_PREFERENCES.vimMode,
    showHidden:
      get<boolean>(KEY_SHOW_HIDDEN) ??
      get<boolean>(LEGACY_KEY_SHOW_HIDDEN_DIRS) ??
      DEFAULT_PREFERENCES.showHidden,
    explorerExcludedFolderNames: normalizeExcludedFolderNames(
      get<string[]>(KEY_EXPLORER_EXCLUDED_FOLDER_NAMES) ??
        DEFAULT_PREFERENCES.explorerExcludedFolderNames,
    ),
    terminalWebglEnabled:
      get<boolean>(KEY_TERMINAL_WEBGL_ENABLED) ??
      DEFAULT_PREFERENCES.terminalWebglEnabled,
    terminalCopyOnSelection:
      get<boolean>(KEY_TERMINAL_COPY_ON_SELECTION) ??
      DEFAULT_PREFERENCES.terminalCopyOnSelection,
    floatingVoiceAgentEnabled:
      get<boolean>(KEY_FLOATING_VOICE_AGENT_ENABLED) ??
      DEFAULT_PREFERENCES.floatingVoiceAgentEnabled,
    terminalFontFamily:
      get<string>(KEY_TERMINAL_FONT_FAMILY) ??
      DEFAULT_PREFERENCES.terminalFontFamily,
    terminalLetterSpacing:
      get<number>(KEY_TERMINAL_LETTER_SPACING) ??
      DEFAULT_PREFERENCES.terminalLetterSpacing,
    terminalFontSize:
      get<number>(KEY_TERMINAL_FONT_SIZE) ??
      DEFAULT_PREFERENCES.terminalFontSize,
    terminalScrollback: clampScrollback(
      get<number>(KEY_TERMINAL_SCROLLBACK) ??
        DEFAULT_PREFERENCES.terminalScrollback,
    ),
    lastWslDistro:
      get<string | null>(KEY_LAST_WSL_DISTRO) ??
      DEFAULT_PREFERENCES.lastWslDistro,
    zoomLevel: get<number>(KEY_ZOOM_LEVEL) ?? DEFAULT_PREFERENCES.zoomLevel,
    shortcuts:
      get<Record<ShortcutId, KeyBinding[]>>(KEY_SHORTCUTS) ??
      DEFAULT_PREFERENCES.shortcuts,
    agentLaunchCommands:
      get<Record<string, string>>(KEY_AGENT_LAUNCH_COMMANDS) ??
      DEFAULT_PREFERENCES.agentLaunchCommands,
    cliAgentIds: normalizeCliAgentIds(
      get<string[]>(KEY_CLI_AGENT_IDS) ?? DEFAULT_PREFERENCES.cliAgentIds,
    ),
    disabledCliAgentIds: normalizeCliAgentIds(
      get<string[]>(KEY_DISABLED_CLI_AGENT_IDS) ??
        DEFAULT_PREFERENCES.disabledCliAgentIds,
    ),
  };
}

export async function setTheme(value: ThemePref): Promise<void> {
  await writePref(KEY_THEME, value);
}

export async function setThemeId(value: string): Promise<void> {
  await writePref(KEY_THEME_ID, value);
}

/** Slider stores 0..1. Actual rendered opacity is halved in SurfaceLayer
 *  so the image never exceeds 50% — keeps UI/terminal readable at any setting. */
export const BG_OPACITY_RENDER_FACTOR = 0.5;

function clampBgOpacity(v: number): number {
  if (!Number.isFinite(v)) return 0.7;
  return Math.min(1, Math.max(0, v));
}

function clampBlur(v: number): number {
  if (!Number.isFinite(v)) return 16;
  return Math.min(64, Math.max(0, Math.round(v)));
}

export async function setBackgroundKind(value: BackgroundKind): Promise<void> {
  await writePref(KEY_BG_KIND, value);
}

export async function setBackgroundImageId(value: string | null): Promise<void> {
  await writePref(KEY_BG_IMAGE_ID, value);
}

export async function setBackgroundOpacity(value: number): Promise<void> {
  await writePref(KEY_BG_OPACITY, clampBgOpacity(value));
}

export async function setBackgroundBlur(value: number): Promise<void> {
  await writePref(KEY_BG_BLUR, clampBlur(value));
}

export async function setCanvasBackgroundImageId(
  value: string | null,
): Promise<void> {
  await writePref(KEY_CANVAS_BG_IMAGE_ID, value);
}

export async function setEditorTheme(value: EditorThemeId): Promise<void> {
  await writePref(KEY_EDITOR_THEME, value);
}

export async function setRemoteAccessEnabled(value: boolean): Promise<void> {
  await writePref(KEY_REMOTE_ACCESS_ENABLED, value);
}

export async function setAutostart(value: boolean): Promise<void> {
  await writePref(KEY_AUTOSTART, value);
}

export async function setRestoreWindowState(value: boolean): Promise<void> {
  await writePref(KEY_RESTORE_WINDOW, value);
}

export async function setSpeechToTextModelId(value: string): Promise<void> {
  await writePref(KEY_SPEECH_TO_TEXT_MODEL, value);
}

export async function setSpeechToTextProviderIds(
  value: readonly string[],
): Promise<void> {
  await writePref(
    KEY_SPEECH_TO_TEXT_PROVIDERS,
    normalizeSpeechToTextProviderIds(value),
  );
}

export async function setDisabledSpeechToTextProviderIds(
  value: readonly string[],
): Promise<void> {
  await writePref(
    KEY_DISABLED_SPEECH_TO_TEXT_PROVIDERS,
    normalizeSpeechToTextProviderIds(value),
  );
}

export async function setVimMode(value: boolean): Promise<void> {
  await writePref(KEY_VIM_MODE, value);
}

export async function setShowHidden(value: boolean): Promise<void> {
  await writePref(KEY_SHOW_HIDDEN, value);
}

export async function setExplorerExcludedFolderNames(
  value: readonly string[],
): Promise<void> {
  await writePref(
    KEY_EXPLORER_EXCLUDED_FOLDER_NAMES,
    normalizeExcludedFolderNames(value),
  );
}

export async function setTerminalWebglEnabled(value: boolean): Promise<void> {
  await writePref(KEY_TERMINAL_WEBGL_ENABLED, value);
}

export async function setTerminalCopyOnSelection(
  value: boolean,
): Promise<void> {
  await writePref(KEY_TERMINAL_COPY_ON_SELECTION, value);
}

export async function setFloatingVoiceAgentEnabled(
  value: boolean,
): Promise<void> {
  await writePref(KEY_FLOATING_VOICE_AGENT_ENABLED, value);
}

export async function setTerminalFontFamily(value: string): Promise<void> {
  await writePref(KEY_TERMINAL_FONT_FAMILY, value.trim());
}

export async function setTerminalLetterSpacing(value: number): Promise<void> {
  const clamped = Number.isFinite(value) ? Math.max(-10, Math.min(10, Math.round(value))) : 0;
  await writePref(KEY_TERMINAL_LETTER_SPACING, clamped);
}

export async function setTerminalFontSize(value: number): Promise<void> {
  const clamped = Number.isFinite(value)
    ? Math.min(
        TERMINAL_FONT_SIZE_MAX,
        Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(value)),
      )
    : TERMINAL_FONT_SIZE_DEFAULT;
  await writePref(KEY_TERMINAL_FONT_SIZE, clamped);
}

function clampScrollback(value: number): number {
  if (!Number.isFinite(value)) return TERMINAL_SCROLLBACK_DEFAULT;
  return Math.min(
    TERMINAL_SCROLLBACK_MAX,
    Math.max(TERMINAL_SCROLLBACK_MIN, Math.round(value)),
  );
}

export async function setTerminalScrollback(value: number): Promise<void> {
  await writePref(KEY_TERMINAL_SCROLLBACK, clampScrollback(value));
}

export async function setLastWslDistro(value: string | null): Promise<void> {
  await writePref(KEY_LAST_WSL_DISTRO, value);
}

export async function setZoomLevel(value: number): Promise<void> {
  await writePref(KEY_ZOOM_LEVEL, value);
}

export async function setShortcuts(
  value: Record<ShortcutId, KeyBinding[]> | {},
): Promise<void> {
  await writePref(KEY_SHORTCUTS, value);
}

export async function resetShortcuts(): Promise<void> {
  await writePref(KEY_SHORTCUTS, DEFAULT_PREFERENCES.shortcuts);
}

export async function setAgentLaunchCommands(
  value: Record<string, string>,
): Promise<void> {
  await writePref(KEY_AGENT_LAUNCH_COMMANDS, value);
}

export async function setCliAgentIds(value: readonly string[]): Promise<void> {
  await writePref(KEY_CLI_AGENT_IDS, normalizeCliAgentIds(value));
}

export async function setDisabledCliAgentIds(
  value: readonly string[],
): Promise<void> {
  await writePref(KEY_DISABLED_CLI_AGENT_IDS, normalizeCliAgentIds(value));
}

export type PrefKey = keyof Preferences;

/** Subscribe to changes from any window (settings → main). */
export async function onPreferencesChange(
  cb: (key: PrefKey, value: unknown) => void,
): Promise<UnlistenFn> {
  const map: Record<string, PrefKey> = {
    [KEY_THEME]: "theme",
    [KEY_THEME_ID]: "themeId",
    [KEY_BG_KIND]: "backgroundKind",
    [KEY_BG_IMAGE_ID]: "backgroundImageId",
    [KEY_BG_OPACITY]: "backgroundOpacity",
    [KEY_BG_BLUR]: "backgroundBlur",
    [KEY_CANVAS_BG_IMAGE_ID]: "canvasBackgroundImageId",
    [KEY_EDITOR_THEME]: "editorTheme",
    [KEY_REMOTE_ACCESS_ENABLED]: "remoteAccessEnabled",
    [KEY_AUTOSTART]: "autostart",
    [KEY_RESTORE_WINDOW]: "restoreWindowState",
    [KEY_SPEECH_TO_TEXT_MODEL]: "speechToTextModelId",
    [KEY_SPEECH_TO_TEXT_PROVIDERS]: "speechToTextProviderIds",
    [KEY_DISABLED_SPEECH_TO_TEXT_PROVIDERS]:
      "disabledSpeechToTextProviderIds",
    [KEY_VIM_MODE]: "vimMode",
    [KEY_SHOW_HIDDEN]: "showHidden",
    [KEY_EXPLORER_EXCLUDED_FOLDER_NAMES]: "explorerExcludedFolderNames",
    [KEY_TERMINAL_WEBGL_ENABLED]: "terminalWebglEnabled",
    [KEY_TERMINAL_COPY_ON_SELECTION]: "terminalCopyOnSelection",
    [KEY_FLOATING_VOICE_AGENT_ENABLED]: "floatingVoiceAgentEnabled",
    [KEY_TERMINAL_FONT_FAMILY]: "terminalFontFamily",
    [KEY_TERMINAL_LETTER_SPACING]: "terminalLetterSpacing",
    [KEY_TERMINAL_FONT_SIZE]: "terminalFontSize",
    [KEY_TERMINAL_SCROLLBACK]: "terminalScrollback",
    [KEY_LAST_WSL_DISTRO]: "lastWslDistro",
    [KEY_ZOOM_LEVEL]: "zoomLevel",
    [KEY_SHORTCUTS]: "shortcuts",
    [KEY_AGENT_LAUNCH_COMMANDS]: "agentLaunchCommands",
    [KEY_CLI_AGENT_IDS]: "cliAgentIds",
    [KEY_DISABLED_CLI_AGENT_IDS]: "disabledCliAgentIds",
  };
  // Same-process writes still fire onChange immediately; cross-window writes
  // arrive via the Tauri event emitted by writePref().
  const unsubLocal = await store.onChange<unknown>((key, value) => {
    const mapped = map[key];
    if (mapped) cb(mapped, value);
  });
  const unsubEvent = await listen<{ key: string; value: unknown }>(
    PREFS_CHANGED_EVENT,
    (e) => {
      const mapped = map[e.payload.key];
      if (mapped) cb(mapped, e.payload.value);
    },
  );
  return () => {
    unsubLocal();
    unsubEvent();
  };
}

// API key changes are stored in OS keychain (not the prefs store),
// so we broadcast via a Tauri event for cross-window listeners.
const KEYS_CHANGED_EVENT = "cmdspace://ai-keys-changed";

export async function emitKeysChanged(): Promise<void> {
  await emit(KEYS_CHANGED_EVENT);
}

export function onKeysChanged(cb: () => void): Promise<UnlistenFn> {
  return listen(KEYS_CHANGED_EVENT, () => cb());
}
