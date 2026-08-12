import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getProvider, PROVIDERS, type ProviderId } from "@/modules/ai/config";
import { clearKey, getAllKeys, setKey } from "@/modules/ai/lib/keyring";
import {
  DEFAULT_SPEECH_TO_TEXT_MODEL_ID,
  getSpeechToTextRequest,
  probeSpeechToText,
  SPEECH_TO_TEXT_MODELS,
} from "@/modules/ai/lib/speechToText";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  emitKeysChanged,
  setDisabledSpeechToTextProviderIds,
  setSpeechToTextModelId,
  setSpeechToTextProviderIds,
} from "@/modules/settings/store";
import {
  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProviderIcon } from "../components/ProviderIcon";
import { ProviderKeyCard } from "../components/ProviderKeyCard";
import { SectionHeader } from "../components/SectionHeader";

type KeysMap = Awaited<ReturnType<typeof getAllKeys>>;

const STT_PROVIDERS = PROVIDERS.filter((provider) =>
  SPEECH_TO_TEXT_MODELS.some((model) => model.provider === provider.id),
);

export function ModelsSection() {
  const configuredIds = usePreferencesStore(
    (state) => state.speechToTextProviderIds,
  );
  const disabledIds = usePreferencesStore(
    (state) => state.disabledSpeechToTextProviderIds,
  );
  const [keys, setKeys] = useState<KeysMap | null>(null);
  const [query, setQuery] = useState("");
  const [editingProviderId, setEditingProviderId] = useState<ProviderId | null>(
    null,
  );

  useEffect(() => {
    void getAllKeys().then(setKeys);
  }, []);

  const configured = useMemo(() => new Set(configuredIds), [configuredIds]);
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);
  const configuredProviders = useMemo(
    () => STT_PROVIDERS.filter(({ id }) => configured.has(id)),
    [configured],
  );
  const catalogProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return STT_PROVIDERS.filter(({ id, label, speechToText }) =>
      !configured.has(id) &&
      (!normalizedQuery ||
        `${label} ${speechToText.label} ${speechToText.description}`
          .toLowerCase()
          .includes(normalizedQuery)),
    );
  }, [configured, query]);
  const connectedCount = useMemo(
    () => configuredProviders.filter((provider) => !!keys?.[provider.id]).length,
    [configuredProviders, keys],
  );

  const onSaveKey = async (provider: ProviderId, value: string) => {
    await setKey(provider, value);
    setKeys((previous) => (previous ? { ...previous, [provider]: value } : previous));
    setEditingProviderId(null);
    await emitKeysChanged();
  };

  const onClearKey = async (provider: ProviderId) => {
    await clearKey(provider);
    setKeys((previous) => (previous ? { ...previous, [provider]: null } : previous));
    await emitKeysChanged();
  };

  const addProvider = async (provider: ProviderId) => {
    await setSpeechToTextProviderIds([...configuredIds, provider]);
    await setDisabledSpeechToTextProviderIds(
      disabledIds.filter((candidate) => candidate !== provider),
    );
    setEditingProviderId(provider);
  };

  const setProviderEnabled = async (provider: ProviderId, enabled: boolean) => {
    const nextDisabled = enabled
      ? disabledIds.filter((candidate) => candidate !== provider)
      : [...disabledIds, provider];
    await setDisabledSpeechToTextProviderIds(nextDisabled);
  };

  if (!keys) {
    return <div className="text-[12px] text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        title="Voice"
        description="Choose a cloud speech provider for the floating voice control. Native speech remains available whenever a cloud provider is unavailable."
      />

      <div className="flex flex-col gap-3">
        <Label>Defaults</Label>
        <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5">
          <SpeechToTextRow
            keys={keys}
            configured={configured}
            disabled={disabled}
          />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[12.5px] font-medium">Configured speech providers</h2>
            <p className="text-[10.5px] text-muted-foreground">
              Enabled providers appear in the STT model picker.
            </p>
          </div>
          <span className="text-[10.5px] text-muted-foreground">
            {connectedCount} connected
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
          {configuredProviders.map((provider, index) => (
            <ConfiguredProviderRow
              key={provider.id}
              provider={provider}
              first={index === 0}
              enabled={!disabled.has(provider.id)}
              currentKey={keys[provider.id]}
              editing={editingProviderId === provider.id}
              onEnabledChange={(enabled) =>
                void setProviderEnabled(provider.id, enabled)
              }
              onConfigure={() => setEditingProviderId(provider.id)}
              onCloseConfigure={() => setEditingProviderId(null)}
              onSave={(value) => onSaveKey(provider.id, value)}
              onClear={() => onClearKey(provider.id)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-[12.5px] font-medium">Add speech provider</h2>
          <p className="text-[10.5px] text-muted-foreground">
            Add only the cloud services you want to configure.
          </p>
        </div>

        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search speech providers"
            aria-label="Search speech providers"
            className="h-9 pl-9 text-[12px]"
          />
        </div>

        {catalogProviders.length ? (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
            {catalogProviders.map((provider, index) => (
              <CatalogProviderRow
                key={provider.id}
                provider={provider}
                first={index === 0}
                onAdd={() => void addProvider(provider.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-[11px] text-muted-foreground">
            {query.trim()
              ? "No speech providers match your search."
              : "All supported speech providers have been added."}
          </div>
        )}
      </section>
    </div>
  );
}

function ConfiguredProviderRow({
  provider,
  first,
  enabled,
  currentKey,
  editing,
  onEnabledChange,
  onConfigure,
  onCloseConfigure,
  onSave,
  onClear,
}: {
  provider: (typeof STT_PROVIDERS)[number];
  first: boolean;
  enabled: boolean;
  currentKey: string | null;
  editing: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onConfigure: () => void;
  onCloseConfigure: () => void;
  onSave: (value: string) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const status = currentKey
    ? { label: "Connected", dot: "bg-emerald-500" }
    : { label: "Needs key", dot: "bg-amber-500" };

  return (
    <div className={cn(!first && "border-t border-border/55")}>
      <div className="flex min-h-16 items-center gap-3 px-3 py-2.5">
        <ProviderIcon provider={provider.id} size={14} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium">{provider.label}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", status.dot)} />
            <span className="truncate text-[10.5px] text-muted-foreground">
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
            {provider.speechToText.label}
            {provider.speechToText.developmentOnly ? " · staged" : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10.5px]"
          onClick={editing ? onCloseConfigure : onConfigure}
        >
          {editing ? "Close" : currentKey ? "Manage" : "Connect"}
        </Button>
        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label={`${enabled ? "Disable" : "Enable"} ${provider.label}`}
        />
      </div>
      {editing ? (
        <div className="border-t border-border/55 bg-muted/15 px-3 py-2.5">
          <ProviderKeyCard
            provider={provider}
            first
            currentKey={currentKey}
            onSave={onSave}
            onClear={onClear}
          />
        </div>
      ) : null}
    </div>
  );
}

function CatalogProviderRow({
  provider,
  first,
  onAdd,
}: {
  provider: (typeof STT_PROVIDERS)[number];
  first: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 px-3 py-2.5",
        !first && "border-t border-border/55",
      )}
    >
      <ProviderIcon provider={provider.id} size={14} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium">{provider.label}</span>
          {provider.speechToText.developmentOnly ? (
            <span className="shrink-0 text-[9.5px] text-muted-foreground">staged</span>
          ) : null}
        </div>
        <p className="truncate text-[10.5px] text-muted-foreground">
          {provider.speechToText.description}
        </p>
      </div>
      <Button size="sm" className="h-7 min-w-16 text-[11px]" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function SpeechToTextRow({
  keys,
  configured,
  disabled,
}: {
  keys: KeysMap;
  configured: ReadonlySet<ProviderId>;
  disabled: ReadonlySet<ProviderId>;
}) {
  const modelId = usePreferencesStore((state) => state.speechToTextModelId);
  const enabledProviders = STT_PROVIDERS.filter(
    ({ id }) => configured.has(id) && !disabled.has(id),
  );
  const currentModel =
    SPEECH_TO_TEXT_MODELS.find((model) => model.modelId === modelId) ??
    SPEECH_TO_TEXT_MODELS.find(
      (model) => model.modelId === DEFAULT_SPEECH_TO_TEXT_MODEL_ID,
    )!;
  const connected = !!keys[currentModel.provider];
  const providerLabel = getProvider(currentModel.provider).label;
  const request = useMemo(
    () => getSpeechToTextRequest(currentModel.modelId, keys),
    [currentModel.modelId, keys],
  );
  const [health, setHealth] = useState<
    | { state: "checking" }
    | { state: "ready" }
    | { state: "unavailable"; message: string }
  >({ state: "checking" });
  const [healthCheckAttempt, setHealthCheckAttempt] = useState(0);

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

  return (
    <>
      <FieldRow label="STT model">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-8 flex-1 justify-between gap-2 px-2.5 text-[11.5px]"
            >
              <span className="flex items-center gap-2 truncate">
                <ProviderIcon provider={currentModel.provider} size={11} />
                <span className="truncate">{currentModel.label}</span>
                {currentModel.developmentOnly ? (
                  <span className="text-muted-foreground">· staged</span>
                ) : null}
              </span>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={11}
                strokeWidth={2}
                className="opacity-70"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" collisionPadding={12} className="min-w-70 p-1">
            {enabledProviders.map((provider) => {
              const models = SPEECH_TO_TEXT_MODELS.filter(
                (model) => model.provider === provider.id,
              );
              const providerConnected = !!keys[provider.id];
              return (
                <div key={provider.id} className="px-1 pt-1.5 first:pt-1">
                  <div className="mb-0.5 flex items-center gap-1.5 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    <ProviderIcon provider={provider.id} size={10} />
                    <span>{provider.label}</span>
                    {!providerConnected ? (
                      <span className="ml-auto text-[9.5px] normal-case tracking-normal text-muted-foreground/70">
                        not connected
                      </span>
                    ) : null}
                  </div>
                  {models.map((model) => (
                    <DropdownMenuItem
                      key={model.modelId}
                      disabled={!providerConnected}
                      onSelect={() =>
                        providerConnected && void setSpeechToTextModelId(model.modelId)
                      }
                      className={cn(
                        "text-[11.5px]",
                        model.modelId === modelId && "bg-accent/50",
                      )}
                    >
                      <span className="flex flex-col">
                        <span>{model.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {model.description}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </FieldRow>
      {currentModel.developmentOnly ? (
        <p className="pl-19 text-[10.5px] text-muted-foreground">
          {providerLabel} is staged for its provider adapter; native speech stays active until then.
        </p>
      ) : !configured.has(currentModel.provider) ? (
        <p className="pl-19 text-[10.5px] text-muted-foreground">
          Add {providerLabel} below to make it available in this picker.
        </p>
      ) : !connected ? (
        <p className="pl-19 text-[10.5px] text-muted-foreground">
          {providerLabel} isn&apos;t connected — configure its API key below.
        </p>
      ) : null}
      <div className="pl-19" aria-live="polite">
        {health.state === "checking" ? (
          <p className="text-[10.5px] text-muted-foreground">Checking STT…</p>
        ) : health.state === "ready" ? (
          <p className="text-[10.5px] text-emerald-600 dark:text-emerald-300">
            STT ready — the selected key, model, and transcription endpoint are working.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[10.5px] text-destructive">
              STT unavailable — {health.message}
            </p>
            {request ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[10.5px]"
                onClick={() => setHealthCheckAttempt((attempt) => attempt + 1)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] tracking-tight text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
      {children}
    </span>
  );
}
