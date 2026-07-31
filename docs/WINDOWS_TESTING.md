# Testing cmdSpace on Windows

Use a physical Windows 10/11 PC or a Windows 11 VM. A Windows bundle cannot be
run directly on macOS, so this is the reliable way to exercise the app and the
native speech backend.

## One-time setup

Install:

- Node.js 24 LTS and pnpm 10.
- Rust stable with the `x86_64-pc-windows-msvc` toolchain.
- Visual Studio Build Tools 2022 with **Desktop development with C++**.
- Microsoft Edge WebView2 Runtime (normally already present on Windows 11).

For voice testing, allow cmdSpace microphone access in **Settings > Privacy &
security > Microphone**. Install at least one Windows Speech language in
**Settings > Time & language > Language & region**.

## Run the app from source

Open PowerShell in the checkout and run:

```powershell
npm install --global pnpm@10
pnpm install --frozen-lockfile
pnpm tauri dev
```

Tauri automatically applies `src-tauri/tauri.windows.conf.json` on Windows.

## Build an installable test app

```powershell
pnpm tauri build
```

The Windows installers are written under
`src-tauri\target\release\bundle\`. Install the generated NSIS `.exe` or MSI
on the test machine.

## Windows acceptance checklist

1. Launch the app and confirm the title is `cmdSpace`.
2. Create and use a terminal; verify keyboard input and resize behavior.
3. Start voice input with no OpenAI API key configured. Speak a short phrase:
   the partial transcript should update while speaking, then become final after
   recognition completes.
4. Confirm the same terminal/canvas workflow still works after switching
   workspaces.

The GitHub Actions `windows-rust` job additionally compiles and lints the
Windows-specific Rust implementation on every pull request and push to `main`.
