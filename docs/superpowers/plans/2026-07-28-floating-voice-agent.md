# Floating Voice Agent – implementation plan

## Goal

Add an opt-in, draggable cmdSpace Voice pill. It records a spoken coding request, transcribes it, asks the existing Prompt Engineer for a concise actionable draft, then inserts that draft into the terminal pane that was active when recording started. It never presses Enter or executes a command.

## Design decisions

- Settings controls visibility; default is off.
- `Cmd/Ctrl+Shift+V` toggles recording when the pill is enabled.
- The pill uses the cmdSpace mark, animated audio bars, a compact state label, and drag handling that does not trigger recording.
- The active terminal target is captured at record start. If it closes, the pill reports an error instead of redirecting to another pane.
- Reuse the existing Whisper/OpenAI transcription and configured Prompt Engineer model path. Do not persist audio or transcript, and do not inject fallback text if refinement fails.

## Tasks

1. Add red tests for the voice prompt request contract, the setting, and shortcut registration.
2. Add a persisted Voice-pill visibility preference and General settings switch.
3. Add a focused voice prompt refinement function that reuses the existing configured language model and respects the prompt-generation timeout/token constraints.
4. Add a voice-controller hook and draggable floating pill; connect it to captured terminal targets and the global shortcut.
5. Update AI-helper and shortcut documentation, run targeted tests, typecheck, build, and diff checks.

## Verification

- Unit/source tests prove the prompt contract, opt-in preference, and shortcut.
- TypeScript build proves integration compiles.
- The user manually checks microphone permission, drag behavior, `Cmd/Ctrl+Shift+V`, editable terminal draft, and that Enter alone submits it.
