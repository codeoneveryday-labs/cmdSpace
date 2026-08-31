import { ensureMonoFontsLoaded } from "@/lib/fonts";

const FONT_READY_TIMEOUT_MS = 1500;

export async function waitForTerminalSessionReady(): Promise<void> {
  const fontReady = (async () => {
    await ensureMonoFontsLoaded();
    await document.fonts.ready;
  })();
  await Promise.race([
    fontReady,
    new Promise<void>((resolve) =>
      window.setTimeout(resolve, FONT_READY_TIMEOUT_MS),
    ),
  ]);
}
