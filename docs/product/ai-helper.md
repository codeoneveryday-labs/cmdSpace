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
then writes the transcript into that captured pane without a carriage return.
The user can edit it and explicitly press Enter; Space does not call a chat
model, create a task brief, or execute terminal input.

Settings -> Models checks the selected cloud STT provider when it opens. A
green `STT ready` state means the selected key, model, and transcription
endpoint accepted an in-memory test recording; an unavailable state explains
the failure and offers a retry. The check never captures microphone input.

Voice audio and transcript are transient. cmdSpace does not persist them. If
transcription or the target-pane insertion fails, the control shows an error
and does not insert the transcript elsewhere.

For supported cloud transcription, Space sends a compact Vietnamese-English
developer vocabulary to preserve cmdSpace, framework, package, and CLI names.
It also extracts only safe identifiers (project name, dependencies, and script
names) from the active workspace's `package.json`, `Cargo.toml`, `go.mod`, and
`pyproject.toml`; raw manifest content is never sent. This improves recognition
of technical terms but does not rewrite the resulting transcript.
