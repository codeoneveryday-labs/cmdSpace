import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

describe("FloatingVoiceAgent", () => {
  it("keeps voice drafts reviewable, target-bound, and moves the pill without toggling voice", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );
    const app = readFileSync(
      path.join(here, "../../../app/App.tsx"),
      "utf8",
    );

    expect(component).toContain("if (suppressClickRef.current)");
    expect(component).toContain("void toggle();");
    expect(component).toContain("bottom-5 right-5");
    expect(component).toContain("overflow-hidden rounded-full");
    expect(component).toContain("dark:bg-zinc-950/95");
    expect(component).toContain("cursor-grab");
    expect(component).toContain("setPointerCapture");
    expect(component).toContain("onPointerMove={move}");
    expect(component).toContain("suppressClickRef");
    expect(component).toContain('draggable={false}');
    expect(component).toContain("Toggle voice input");
    expect(app).toContain("captureVoiceTarget");
    expect(app).toContain("insertVoiceDraft");
    expect(app).toContain('"voice.toggle": toggleVoiceAgent');
    expect(app).toContain("pendingVoiceDraftsRef");
    expect(app).toContain("terminal.replaceCurrentInput(nextDraft)");
    expect(app).not.toContain("terminal.replaceInput(previousDraft, nextDraft)");
    expect(app).not.toContain('terminal.write(nextDraft);');
    expect(app).not.toContain('terminal.write(draft.replace(/[\\r\\n]+$/, "") + "\\r")');
  });

  it("targets the active real PTY inside an Architecture canvas", () => {
    const app = readFileSync(
      path.join(here, "../../../app/App.tsx"),
      "utf8",
    );
    const stack = readFileSync(
      path.join(here, "../../architecture/ArchitectureStack.tsx"),
      "utf8",
    );
    const canvas = readFileSync(
      path.join(here, "../../architecture/ArchitectureCanvas.tsx"),
      "utf8",
    );
    const canvasTerminal = readFileSync(
      path.join(here, "../../architecture/CanvasTerminalNode.tsx"),
      "utf8",
    );

    expect(app).toContain('kind: "canvas-terminal"');
    expect(app).toContain("canvasTerminalRefs.current.get");
    expect(app).toContain("onCanvasTerminalHandleChange");
    expect(app).toContain("onActiveCanvasTerminalChange");
    expect(stack).toContain("onTerminalHandleChange");
    expect(stack).toContain("onActiveTerminalChange");
    expect(canvas).toContain("onHandleChange");
    expect(canvasTerminal).toContain("export type CanvasTerminalHandle");
    expect(canvasTerminal).toContain("replaceCurrentInput");
    expect(canvasTerminal).toContain("getBuffer");
  });

  it("writes every transcript directly into the active terminal without chat refinement", () => {
    const voiceAgent = readFileSync(
      path.join(here, "../hooks/useVoicePromptAgent.ts"),
      "utf8",
    );

    expect(voiceAgent).toContain("insertTranscript(target, transcript)");
    expect(voiceAgent).not.toContain("generateVoicePrompt");
    expect(voiceAgent).not.toContain("loadVoicePromptHistory");
    expect(voiceAgent).not.toContain("saveVoicePromptHistory");
    expect(voiceAgent).not.toContain("useChatStore");
    expect(voiceAgent).toContain('"Transcript inserted into terminal."');
  });

  it("keeps voice input as literal speech to text without task control", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );
    const voiceAgent = readFileSync(
      path.join(here, "../hooks/useVoicePromptAgent.ts"),
      "utf8",
    );
    const app = readFileSync(
      path.join(here, "../../../app/App.tsx"),
      "utf8",
    );

    expect(component).toContain("Toggle voice input");
    expect(voiceAgent).not.toContain("parseSpaceCommand");
    expect(voiceAgent).not.toContain("executeSpaceCommand");
    expect(voiceAgent).not.toContain("Space is starting music");
    expect(app).not.toContain("executeSpaceCommand={executeSpaceCommand}");
  });

  it("does not carry prompt context into the speech-to-text input path", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );
    const voiceAgent = readFileSync(
      path.join(here, "../hooks/useVoicePromptAgent.ts"),
      "utf8",
    );
    const app = readFileSync(
      path.join(here, "../../../app/App.tsx"),
      "utf8",
    );

    expect(component).toContain("useSpeechToTextInput");
    expect(voiceAgent).toContain("export function useSpeechToTextInput");
    expect(voiceAgent).not.toContain("terminalContext");
    expect(voiceAgent).not.toContain("cwd:");
    expect(app).not.toContain("terminalContext:");
  });

  it("shows the actionable voice failure instead of a generic retry label", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );
    const recordingHook = readFileSync(
      path.join(here, "../hooks/useWhisperRecording.ts"),
      "utf8",
    );
    const packageManifest = JSON.parse(
      readFileSync(path.join(here, "../../../../package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(component).toContain("message ?? LABELS[status]");
    expect(component).not.toContain('error: "Try again"');
    expect(recordingHook).toContain("nativeSpeechStartMessage(error)");
    expect(packageManifest.scripts["voice:debug"]).toContain(
      "tauri build --debug --bundles app",
    );
  });

  it("keeps long status messages inside the floating voice pill", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );

    expect(component).toContain("max-w-[min(420px,calc(100vw-24px))]");
    expect(component).toContain("min-w-0 flex-1 truncate whitespace-nowrap");
    expect(component).toContain("title={label}");
    expect(component).not.toContain('status === "clarification"');
  });

  it("gives the listening waveform a voice-reactive ember glow", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );

    expect(component).toContain("voiceInputGlow");
    expect(component).toContain("audioLevel * 26");
    expect(component).toContain("transition-[box-shadow,color,border-color,background-color]");
    expect(component).toContain("motion-reduce:transition-none");
  });

  it("uses the selected STT provider and keeps native speech as fallback", () => {
    const recordingHook = readFileSync(
      path.join(here, "../hooks/useWhisperRecording.ts"),
      "utf8",
    );
    const voiceAgent = readFileSync(
      path.join(here, "../hooks/useVoicePromptAgent.ts"),
      "utf8",
    );

    expect(recordingHook).toContain("getSpeechToTextRequest");
    expect(recordingHook).toContain('formData.append("model", request.modelId)');
    expect(recordingHook).toContain("fetch(request.endpoint");
    expect(recordingHook).toContain("speechToTextModelId: string");
    expect(recordingHook).toContain("apiKeys: Partial<Record<ProviderId, string | null>>");
    expect(recordingHook).toContain("startNativeRecognition");
    expect(recordingHook).toContain("unavailableRequestRef.current");
    expect(recordingHook).toContain("!cloudRequest");
    expect(recordingHook).toContain("!canRecordCloudAudio()");
    expect(recordingHook).toContain('invoke("speech_stop")');
    expect(recordingHook).toContain('listen<SpeechResult>("cmdspace:speech-result"');
    expect(recordingHook).not.toContain("webkitSpeechRecognition");
    expect(voiceAgent).toContain("speechToTextModelId");
    expect(voiceAgent).toContain("apiKeys,");
    expect(recordingHook).toContain('formData.append("language", request.language)');
  });

  it("falls back to native speech immediately and does not turn silence into a draft", () => {
    const recordingHook = readFileSync(
      path.join(here, "../hooks/useWhisperRecording.ts"),
      "utf8",
    );

    expect(recordingHook).toContain("hasDetectedVoiceActivity");
    expect(recordingHook).toContain("No speech was detected. Try again.");
    expect(recordingHook).toContain("void startNativeRecognition();");
  });

  it("stops capture after the speaker finishes a request", () => {
    const recordingHook = readFileSync(
      path.join(here, "../hooks/useWhisperRecording.ts"),
      "utf8",
    );

    expect(recordingHook).toContain("AUTO_STOP_AFTER_VOICE_SILENCE_MS");
    expect(recordingHook).toContain("scheduleSilenceStop");
    expect(recordingHook).toContain("window.setTimeout(");
    expect(recordingHook).toContain("stopCapture,");
  });

  it("discovers the exact speech locales available on this Mac", () => {
    const speech = readFileSync(
      path.join(here, "../../../../src-tauri/src/modules/speech.rs"),
      "utf8",
    );
    const app = readFileSync(
      path.join(here, "../../../../src-tauri/src/lib.rs"),
      "utf8",
    );

    expect(speech).toContain("pub fn speech_supported_locales");
    expect(speech).toContain("SFSpeechRecognizer::supportedLocales()");
    expect(speech).toContain("localeIdentifier");
    expect(app).toContain("speech::speech_supported_locales");
  });

  it("uses Windows' installed native Speech recognizers for unpackaged builds", () => {
    const speech = readFileSync(
      path.join(here, "../../../../src-tauri/src/modules/speech.rs"),
      "utf8",
    );

    expect(speech).toContain('#[cfg(target_os = "windows")]');
    expect(speech).toContain("SpeechRecognitionEngine.InstalledRecognizers()");
    expect(speech).toContain("SetInputToDefaultAudioDevice");
    expect(speech).toContain("AudioLevelUpdated");
    expect(speech).toContain('Command::new("powershell.exe")');
    expect(speech).toContain("Windows Settings → Time & language → Language & region");
  });

  it("streams Windows speech hypotheses before emitting the final transcript", () => {
    const speech = readFileSync(
      path.join(here, "../../../../src-tauri/src/modules/speech.rs"),
      "utf8",
    );

    expect(speech).toContain("SpeechHypothesized");
    expect(speech).toContain("EmitResult(text, false)");
    expect(speech).toContain("EmitResult(text, true)");
    expect(speech).toContain('.get("final")');
  });

  it("keeps terminal transcript insertion language-neutral for automatic multilingual transcripts", () => {
    const voiceAgent = readFileSync(
      path.join(here, "../hooks/useVoicePromptAgent.ts"),
      "utf8",
    );

    expect(voiceAgent).not.toContain("voiceLanguage");
    expect(voiceAgent).toContain("insertTranscript(target, transcript)");
    expect(voiceAgent).not.toContain("generateVoicePrompt");
  });

  it("drives the voice waveform from native microphone levels", () => {
    const component = readFileSync(
      path.join(here, "FloatingVoiceAgent.tsx"),
      "utf8",
    );
    const recordingHook = readFileSync(
      path.join(here, "../hooks/useWhisperRecording.ts"),
      "utf8",
    );
    const speech = readFileSync(
      path.join(here, "../../../../src-tauri/src/modules/speech.rs"),
      "utf8",
    );

    expect(recordingHook).toContain('listen<number>("cmdspace:speech-level"');
    expect(recordingHook).toContain("audioLevel");
    expect(component).toContain("audioLevel");
    expect(component).toContain("scaleY(");
    expect(component).not.toContain('status === "listening" ? "animate-pulse"');
    expect(speech).toContain("cmdspace:speech-level");
    expect(speech).toContain("floatChannelData");
  });

  it("routes speech through the native macOS Speech framework", () => {
    const speech = readFileSync(
      path.join(here, "../../../../src-tauri/src/modules/speech.rs"),
      "utf8",
    );

    expect(speech).toContain("SFSpeechRecognizer");
    expect(speech).toContain("SFSpeechAudioBufferRecognitionRequest");
    expect(speech).toContain("AVAudioEngine");
    expect(speech).toContain("cmdspace:speech-result");
    expect(speech).toContain("request.endAudio()");
    expect(speech).toContain("Dropping the request or task here loses the final words");
    expect(speech).toContain("clear_session_for_result");
  });

  it("declares macOS speech-recognition usage for the desktop bundle", () => {
    const infoPlist = readFileSync(
      path.join(here, "../../../../src-tauri/Info.plist"),
      "utf8",
    );

    expect(infoPlist).toContain("NSSpeechRecognitionUsageDescription");
  });

  it("rebuilds the development binary when macOS privacy keys change", () => {
    const buildScript = readFileSync(
      path.join(here, "../../../../src-tauri/build.rs"),
      "utf8",
    );

    expect(buildScript).toContain('cargo:rerun-if-changed=Info.plist');
  });

  it("keeps voice input independent from the removed text-chat controls", () => {
    const modelsSection = readFileSync(
      path.join(here, "../../../settings/sections/ModelsSection.tsx"),
      "utf8",
    );

    expect(modelsSection).toContain("Configured speech providers");
    expect(modelsSection).not.toContain("Voice needs an OpenAI key");
  });
});
