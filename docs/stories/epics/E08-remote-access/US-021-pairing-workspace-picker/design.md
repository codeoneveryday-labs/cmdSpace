# Design

## Flow

1. Settings renders the public URL as text and QR when the tunnel is ready.
2. The phone scans the QR and opens the existing remote pairing screen.
3. Successful one-time pairing stores the bearer token in the browser.
4. The authenticated directory endpoint returns separate folder and file rows.
5. Folder rows navigate deeper; the primary action opens the current folder.
6. File rows select their parent directory and continue to the terminal.

## Security

The QR contains only the ephemeral public URL. Directory listing remains behind
bearer authentication. Canonical paths must remain within home or launch cwd;
the endpoint returns names and paths only, never file contents.

## UI

Keep the dark, terminal-like remote surface. Use 44px minimum touch targets,
visible file/folder labels, loading and recovery states, and a compact QR card
inside Settings without replacing the existing copy/open actions.
