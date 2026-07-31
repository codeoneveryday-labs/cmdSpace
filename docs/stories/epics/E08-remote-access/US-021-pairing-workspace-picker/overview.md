# Overview

## Current Behavior

Settings exposes the public URL and pairing code as text. After pairing, the
remote browser can navigate folders, but files are not shown.

## Target Behavior

Settings shows a scannable QR for the ready public URL. After pairing, the
remote browser presents a mobile-first file and folder picker before opening a
terminal. Choosing a file opens its containing folder as the terminal cwd.

## Non-Goals

- Persistent user-defined passwords.
- Embedding the pairing secret in the public QR.
- Reading, previewing, uploading, or editing file contents in the picker.
