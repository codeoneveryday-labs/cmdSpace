import {
  getSpeechToTextRequest,
  probeSpeechToText,
  type SpeechToTextModel,
} from "@/modules/ai/lib/speechToText";
import type { ProviderId } from "@/modules/ai/config";
import { setSpeechToTextModelId } from "@/modules/settings/store";
import { useCallback, useEffect, useMemo, useState } from "react";

type Health =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "unavailable"; message: string };

export function useSpeechToTextHealth({
  currentModel,
  fallbackModel,
  configured,
  disabled,
  keys,
  providerLabel,
}: {
  currentModel: SpeechToTextModel;
  fallbackModel: SpeechToTextModel | undefined;
  configured: ReadonlySet<ProviderId>;
  disabled: ReadonlySet<ProviderId>;
  keys: Record<string, string | null>;
  providerLabel: string;
}) {
  const request = useMemo(
    () => getSpeechToTextRequest(currentModel.modelId, keys),
    [currentModel.modelId, keys],
  );
  const [health, setHealth] = useState<Health>({ state: "checking" });
  const [healthCheckAttempt, setHealthCheckAttempt] = useState(0);

  useEffect(() => {
    if (currentModel.developmentOnly && fallbackModel) {
      void setSpeechToTextModelId(fallbackModel.modelId);
    }
  }, [currentModel.developmentOnly, fallbackModel]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const unavailable = (message: string) => {
      if (!disposed) setHealth({ state: "unavailable", message });
    };

    if (currentModel.developmentOnly) {
      unavailable("This STT provider is not available yet.");
      return () => {
        disposed = true;
        controller.abort();
      };
    }
    if (!configured.has(currentModel.provider) || disabled.has(currentModel.provider)) {
      unavailable("Enable this provider to check STT.");
      return () => {
        disposed = true;
        controller.abort();
      };
    }
    if (!request) {
      unavailable(`${providerLabel} needs an API key.`);
      return () => {
        disposed = true;
        controller.abort();
      };
    }

    setHealth({ state: "checking" });
    void probeSpeechToText(request, fetch, controller.signal).then(
      () => {
        if (!disposed) setHealth({ state: "ready" });
      },
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!disposed) {
          setHealth({
            state: "unavailable",
            message:
              error instanceof Error && error.message
                ? error.message
                : "Could not reach the STT service.",
          });
        }
      },
    );

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [configured, currentModel, disabled, healthCheckAttempt, providerLabel, request]);

  const retry = useCallback(() => {
    setHealthCheckAttempt((attempt) => attempt + 1);
  }, []);

  return { health, request, retry };
}
