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

## Required native build gate

Run these from an **MSVC Developer PowerShell** in the checkout before treating
host-neutral Rust tests as Windows evidence:

```powershell
pnpm exec tsc --noEmit
pnpm test
pnpm build
Push-Location src-tauri
cargo fmt --all -- --check
cargo check --target x86_64-pc-windows-msvc --all-targets --locked
cargo clippy --target x86_64-pc-windows-msvc --all-targets --locked -- -D warnings
cargo test --target x86_64-pc-windows-msvc --all-targets --locked
Pop-Location
```

Record the Windows version, MSVC/Windows SDK version, Rust version, and each
command result with the validation evidence. A macOS cross-check is not a
substitute: native C dependencies require the Windows SDK headers and MSVC.

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
3. Start voice input with no usable cloud transcription key configured. Speak
   a short phrase: the partial transcript should update while speaking, then
   become final after recognition completes. Confirm that cmdSpace inserts the
   final text into the terminal captured at recording start without pressing
   Enter or executing it.
4. Cancel voice input, immediately start it again, and speak a different short
   phrase. Only the second session may update the waveform, show an error, or
   insert a final transcript. This exercises the session-id fence for buffered
   PowerShell output after a replaced process exits.
5. Start a voice session and remain silent. The app should show the existing
   no-speech outcome and return to idle without retaining a live microphone
   process.
6. Confirm the same terminal/canvas workflow still works after switching
   workspaces.

## WSL acceptance checklist

1. In PowerShell, record `wsl --status` and `wsl --list --verbose`; use an
   installed, running distro for the test.
2. Launch cmdSpace, open the workspace-environment selector, and choose
   `WSL: <distro>`. It must not report the distro as unavailable.
3. Create a terminal and run `uname -s`, `pwd`, and `printf '%s\n'
   "$CMDSPACE_TERMINAL"`. Expect a Linux shell, the selected WSL working
   directory, and `1` respectively.
4. In that terminal, create a harmless file under the selected workspace,
   refresh Explorer, rename it once, then remove it through Explorer. Confirm
   the WSL file operations and the terminal see the same path.
5. Switch the environment back to Windows, open a fresh terminal, and confirm
   it is not reusing the WSL shell or current directory.

The GitHub Actions `windows-rust` job additionally compiles and lints the
Windows-specific Rust implementation on every pull request and push to `main`.
