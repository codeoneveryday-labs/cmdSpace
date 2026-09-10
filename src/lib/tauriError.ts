export type IpcError = {
  code: string;
  message: string;
};

/** Error instance that preserves the stable native error code for callers. */
export class TauriIpcError extends Error {
  readonly code: string;

  constructor({ code, message }: IpcError) {
    super(message);
    this.name = "TauriIpcError";
    this.code = code;
  }
}

export function parseIpcError(reason: unknown): IpcError {
  if (typeof reason === "object" && reason !== null) {
    const candidate = reason as { code?: unknown; message?: unknown };
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return { code: candidate.code, message: candidate.message };
    }
    if (reason instanceof Error) {
      return { code: "UNKNOWN", message: reason.message };
    }
  }
  return { code: "UNKNOWN", message: String(reason) };
}

export function toTauriIpcError(reason: unknown): TauriIpcError {
  return new TauriIpcError(parseIpcError(reason));
}
