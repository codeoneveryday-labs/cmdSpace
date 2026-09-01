import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { TerminalShell } from "@/modules/settings/store";
import {
  setFloatingVoiceAgentEnabled,
  setTerminalCopyOnSelection,
  setTerminalFontFamily,
  setTerminalFontSize,
  setTerminalLetterSpacing,
  setTerminalScrollback,
  setTerminalShell,
  setTerminalWebglEnabled,
  TERMINAL_FONT_SIZES,
  TERMINAL_SCROLLBACK_PRESETS,
} from "@/modules/settings/store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingRow } from "../components/SettingRow";

export const TERMINAL_SHELLS: { id: TerminalShell; label: string }[] = [
  { id: "system", label: "System default" },
  { id: "zsh", label: "zsh" },
  { id: "bash", label: "bash" },
  { id: "fish", label: "fish" },
];

const LETTER_SPACINGS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

export function TerminalPreferencesSection({
  availableShells,
}: {
  availableShells: TerminalShell[];
}) {
  const terminalShell = usePreferencesStore((state) => state.terminalShell);
  const terminalWebglEnabled = usePreferencesStore(
    (state) => state.terminalWebglEnabled,
  );
  const terminalCopyOnSelection = usePreferencesStore(
    (state) => state.terminalCopyOnSelection,
  );
  const floatingVoiceAgentEnabled = usePreferencesStore(
    (state) => state.floatingVoiceAgentEnabled,
  );
  const terminalFontFamily = usePreferencesStore((state) => state.terminalFontFamily);
  const terminalLetterSpacing = usePreferencesStore(
    (state) => state.terminalLetterSpacing,
  );
  const terminalFontSize = usePreferencesStore((state) => state.terminalFontSize);
  const terminalScrollback = usePreferencesStore((state) => state.terminalScrollback);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
        Terminal
      </span>
      <SettingRow
        title="Default shell"
        description="Which shell each new terminal starts with. Running terminals keep their current shell."
      >
        <Select
          value={terminalShell}
          onValueChange={(value) => void setTerminalShell(value as TerminalShell)}
        >
          <SelectTrigger size="sm" className="h-8 w-40 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERMINAL_SHELLS.map((shell) => (
              <SelectItem
                key={shell.id}
                value={shell.id}
                disabled={!availableShells.includes(shell.id)}
                className="text-[12px]"
              >
                {shell.label}
                {!availableShells.includes(shell.id) ? " (not installed)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        title={
          <span className="inline-flex items-center gap-1.5">
            Use WebGL renderer
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-help text-[11px] text-muted-foreground/70 leading-none"
                    aria-label="More info about WebGL renderer"
                  >
                    ⓘ
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-65 text-[11px]">
                  xterm's WebGL renderer caches glyphs in a GPU texture atlas. It
                  can be faster with very busy terminal output, but some macOS
                  input methods and GPU drivers behave better with the default
                  renderer.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        }
        description="Optional hardware acceleration. Leave off if Vietnamese input, text rendering, or pane repainting behaves oddly."
      >
        <Switch
          checked={terminalWebglEnabled}
          onCheckedChange={(value) => void setTerminalWebglEnabled(value)}
        />
      </SettingRow>
      <SettingRow
        title="Copy selected text"
        description="Automatically copy terminal text to the clipboard after a selection settles."
      >
        <Switch
          checked={terminalCopyOnSelection}
          onCheckedChange={(value) => void setTerminalCopyOnSelection(value)}
        />
      </SettingRow>
      <SettingRow
        title="Space"
        description="Show the draggable Space voice control over terminal panes. Cmd/Ctrl+Shift+V starts or stops recording."
      >
        <Switch
          checked={floatingVoiceAgentEnabled}
          onCheckedChange={(value) => void setFloatingVoiceAgentEnabled(value)}
        />
      </SettingRow>
      <SettingRow
        title="Font family"
        description='Nerd Font name for icons (e.g. "CaskaydiaCove Nerd Font Mono"). Leave blank to auto-detect.'
      >
        <input
          type="text"
          value={terminalFontFamily}
          placeholder="Auto-detect"
          onChange={(event) => void setTerminalFontFamily(event.target.value)}
          className="h-8 w-48 rounded-md border border-border bg-background px-2.5 text-[12px] outline-none focus:border-foreground/40"
        />
      </SettingRow>
      <SettingRow
        title="Letter spacing"
        description="Extra horizontal space between characters (px). Use negative values to tighten Nerd Fonts."
      >
        <Select
          value={String(terminalLetterSpacing)}
          onValueChange={(value) => void setTerminalLetterSpacing(Number(value))}
        >
          <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LETTER_SPACINGS.map((value) => (
              <SelectItem key={value} value={String(value)} className="text-[12px]">
                {value > 0 ? `+${value}` : value} px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow title="Font size" description="Terminal text size.">
        <Select
          value={String(terminalFontSize)}
          onValueChange={(value) => void setTerminalFontSize(Number(value))}
        >
          <SelectTrigger size="sm" className="h-8 w-28 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERMINAL_FONT_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-[12px]">
                {size} px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        title="Scrollback"
        description="Lines of history kept per terminal. Higher uses more RAM (~3 KB / line)."
      >
        <Select
          value={String(terminalScrollback)}
          onValueChange={(value) => void setTerminalScrollback(Number(value))}
        >
          <SelectTrigger size="sm" className="h-8 w-36 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERMINAL_SCROLLBACK_PRESETS.map((lines) => (
              <SelectItem key={lines} value={String(lines)} className="text-[12px]">
                {lines.toLocaleString()} lines
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  );
}
