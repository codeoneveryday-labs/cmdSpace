# AI Helper

cmdSpace exposes the existing AI chat assistant in the right sidebar under the
Helper view. The Helper view must reuse the same session, composer, provider
configuration, approval flow, terminal context, file attachment flow, and agent
persona infrastructure as the Cmd+I chat surface.

The first Helper slice is a docked chat surface:

- The right sidebar Helper tab renders the active AI chat history.
- The Helper input can send messages through the existing AI transport.
- Sending from Helper must keep the conversation docked in Helper; it must not
  auto-open the Cmd+I mini chat popup.
- The empty Helper view should look like an actionable chat surface, with
  compact suggested prompts near the composer instead of a distant centered
  placeholder.
- The Helper composer should have a visible send action and a clear input
  boundary.
- If no usable cloud key or local model is configured, the Helper shows the
  existing provider connection affordance.
- The existing Cmd+I input bar and mini-window remain available and continue to
  share the same active chat session.

Future slices may add Helper-specific session navigation, sidebar-optimized
suggestions, and richer terminal diagnostics, but they should not fork the AI
transport or create a second chat state model.

## Space

Settings -> General can enable Space. The draggable control
can also be toggled with `Cmd/Ctrl+Shift+V`. It captures the current
non-private terminal pane when recording begins, transcribes with the selected
shared-key STT provider when one is available, and immediately falls back to
native speech if that provider fails. It ignores silent microphone sessions,
then asks the selected chat model to act as Space. It turns a
spoken coding request into a compact but implementation-ready `ship` task
brief, or an explicitly requested investigation into a `scout` task brief.
For non-trivial implementation requests, the brief preserves the named
technologies, integrations, primary behavior, and grounded checks without
inventing an unstated language or stack. The brief is written into that
captured pane without a carriage return, so the user can edit it and explicitly
press Enter. A supported Space app request can be performed directly; for
example, asking it to create a music terminal and play a playlist opens Music
CLI and starts the top result, even when speech recognition omits the wake word.
Speech without a clear task objective becomes a compact, reviewable draft instead of interrupting the
voice-to-terminal flow with a follow-up question.

Voice audio, transcript, and generated task brief are transient. cmdSpace does
not persist them. The raw transcript is never appended to the CLI brief. If
transcription, task compilation, or the target pane fails, the control shows an
error and does not insert the raw transcript elsewhere.
