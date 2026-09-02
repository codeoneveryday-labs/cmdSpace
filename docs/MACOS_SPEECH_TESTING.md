# Testing bundled native speech on macOS

This runbook supplies the manual runtime proof that unit tests cannot provide
for the macOS Speech/AVAudioEngine lifecycle. Run it on a physical Mac from a
debug or release **app bundle**, not `tauri dev`.

## Preconditions

1. Record the macOS version, hardware architecture, Xcode version, and
   `rustc --version` in the validation evidence.
2. In **System Settings → Privacy & Security**, allow the test app access to
   both **Microphone** and **Speech Recognition**. If a prior denial is being
   retested, reset or change the permission deliberately and record it.
3. Build and launch a debug bundle from the checkout:

   ```bash
   pnpm install --frozen-lockfile
   pnpm voice:debug
   ```

   The command intentionally builds a bundle before opening it; native speech
   is unsupported from `tauri dev`.
4. Keep one normal terminal pane focused. Configure no usable cloud STT key,
   or deliberately make cloud capture unavailable, so the test takes the
   native `speech_start` path.

## Required acceptance sequence

1. Start voice input (the standard `Cmd+Shift+V` shortcut or the visible voice
   control), speak a short phrase, and stop/confirm it. The microphone level
   should react while recording; the final phrase must be inserted into the
   terminal that was focused at start, without sending Enter or executing it.
2. Start voice input and cancel it. No final transcript or error from that
   cancelled session may alter the next recording.
3. Immediately start a second recording after cancel, then speak a distinct
   phrase. Only that second phrase may appear. This proves stale macOS
   level/result/error callbacks do not escape their request generation.
4. Confirm a normal recording after a partial result. It must retain the final
   words, return the UI to idle once, and not produce a duplicate stopped/error
   outcome.
5. Stay silent for one recording. Verify the existing no-speech feedback and
   that another recording can start afterwards.
6. If a Bluetooth input route is available, switch to it, start a recording,
   and verify the route-settle retry either succeeds once or reports a clear
   start failure without leaving the UI recording indefinitely.

## Evidence to attach

- App build type and version, machine/OS details, and permission state.
- Pass/fail result for each numbered step, with a screenshot or screen capture
  for any failure.
- Relevant app logs when a failure occurs, with secrets and spoken sensitive
  content removed.

Do not call a host-only `cargo test` pass proof of this checklist. The target
observable behavior is permission, microphone, AVAudioEngine, and bundle
lifecycle behavior.
