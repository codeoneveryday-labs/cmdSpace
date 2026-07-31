export class TerminalOutputQueue {
  private chunks: string[] = [];
  private frame: number | null = null;

  constructor(
    private readonly write: (data: string) => void,
    private readonly schedule: (callback: FrameRequestCallback) => number =
      requestAnimationFrame,
  ) {}

  push(data: string) {
    if (!data) return;
    this.chunks.push(data);
    if (this.frame !== null) return;
    this.frame = this.schedule(() => {
      this.frame = null;
      const output = this.chunks.join("");
      this.chunks = [];
      if (output) this.write(output);
    });
  }

  dispose() {
    this.chunks = [];
    if (this.frame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.frame);
    }
    this.frame = null;
  }
}
