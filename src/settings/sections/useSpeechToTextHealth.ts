import {
  getSpeechToTextRequest,
  probeSpeechToText,
  type SpeechToTextModel,
} from "@/modules/ai/lib/speechToText";
import type { ProviderId } from "@/modules/ai/config";
import { setSpeechToTextModelId } from "@/modules/settings/store";
import { useCallback, useEffect, useState } from "react";

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
  const request = getSpeechToTextRequest(currentModel.modelId, keys);
  const [health, setHealth] = useState<Health>({ state: "checking" });
  const [healthCheckAttempt, setHealthCheckAttempt] = useState(0);

  useEffect(() => {
    if (currentModel.developmentOnly && fallbackModel) {
      void setSpeechToTextModelId(fallbackModel.modelId);
    }
  }, [currentModel.developmentOnly, fallbackModel]);

  useEffect(() => {
    let disposed = false;
    const unavailable = (message: string) => {
      if (!disposed) setHealth({ state: "unavailable", message });
    };

    if (currentModel.developmentOnly) {
      unavailable("This STT provider is not available yet.");
      return () => {
        disposed = true;
      };
    }
    if (!configured.has(currentModel.provider) || disabled.has(currentModel.provider)) {
      unavailable("Enable this provider to check STT.");
      return () => {
        disposed = true;
      };
    }
    if (!request) {
      unavailable(`${providerLabel} needs an API key.`);
      return () => {
        disposed = true;
      };
    }

    setHealth({ state: "checking" });
    void probeSpeechToText(request).then(
      () => {
        if (!disposed) setHealth({ state: "ready" });
      },
      (error: unknown) => {
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
    };
  }, [configured, currentModel, disabled, healthCheckAttempt, providerLabel, request]);

  const retry = useCallback(() => {
    setHealthCheckAttempt((attempt) => attempt + 1);
  }, []);

  return { health, request, retry };
}
