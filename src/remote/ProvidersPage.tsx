import {
  ArrowLeft01Icon,
  Search01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";

import { remoteApiPath } from "./lib/remoteUtils";

type ProviderEntry = {
  id: string;
  name: string;
  executable: string;
  description: string;
  installUrl: string | null;
  configured: boolean;
  enabled: boolean;
};

type ProvidersPageProps = {
  authToken: string;
  onBack: () => void;
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: "#d97757",
  codex: "#10a37f",
  gemini: "#4285f4",
  opencode: "#58a6ff",
  copilot: "#8b5cf6",
  cursor: "#000000",
  aider: "#f59e0b",
  pi: "#e11d48",
  amp: "#16a34a",
  cline: "#7c3aed",
  goose: "#22c55e",
  qwen: "#64748b",
  kimi: "#0ea5e9",
  openhands: "#ef4444",
  kiro: "#f97316",
  grok: "#facc15",
  herdr: "#06b6d4",
  cmd: "#888888",
};

export function ProvidersPage({ authToken, onBack }: ProvidersPageProps) {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(remoteApiPath("/api/remote/providers"), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (response.status === 401) throw new Error("unauthorized");
        if (!response.ok) throw new Error("Failed to load providers");
        return response.json() as Promise<{ providers: ProviderEntry[] }>;
      })
      .then((payload) => {
        if (!cancelled) setProviders(payload.providers);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const configured = useMemo(
    () => providers.filter((provider) => provider.configured),
    [providers],
  );

  const available = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return providers
      .filter((provider) => !provider.configured)
      .filter(
        (provider) =>
          !normalizedQuery ||
          [provider.name, provider.executable, provider.description].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          ),
      );
  }, [providers, query]);

  if (loading) {
    return (
      <main className="remote-providers-screen">
        <ProvidersHeader onBack={onBack} />
        <p className="remote-providers-message">Loading providers…</p>
      </main>
    );
  }

  return (
    <main className="remote-providers-screen">
      <ProvidersHeader onBack={onBack} />

      {error ? (
        <p className="remote-providers-message remote-providers-error">{error}</p>
      ) : (
        <>
          <section className="remote-providers-section">
            <h3>Providers</h3>
            <div className="remote-providers-list">
              {configured.map((provider) => (
                <div key={provider.id} className="remote-provider-row">
                  <span className="remote-provider-chevron">›</span>
                  <span
                    className="remote-provider-icon"
                    style={{ color: PROVIDER_ICONS[provider.id] ?? "#ff8a00" }}
                  >
                    <HugeiconsIcon icon={TerminalIcon} size={18} />
                  </span>
                  <span className="remote-provider-info">
                    <span className="remote-provider-name-row">
                      <strong>{provider.name}</strong>
                      <span
                        className="remote-provider-dot"
                        data-enabled={provider.enabled || undefined}
                      />
                    </span>
                    <small>{provider.executable}</small>
                  </span>
                  <span
                    className="remote-provider-toggle"
                    role="switch"
                    aria-checked={provider.enabled}
                    data-enabled={provider.enabled || undefined}
                  >
                    <span />
                  </span>
                </div>
              ))}
              {configured.length === 0 ? (
                <p className="remote-providers-message">No providers configured on this Mac yet.</p>
              ) : null}
            </div>
          </section>

          <section className="remote-providers-section">
            <h3>Add provider</h3>
            <label className="remote-providers-search">
              <HugeiconsIcon icon={Search01Icon} size={16} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search providers"
                aria-label="Search providers"
              />
            </label>
            <div className="remote-providers-list">
              {available.map((provider) => (
                <div key={provider.id} className="remote-provider-row">
                  <span className="remote-provider-chevron">›</span>
                  <span
                    className="remote-provider-icon"
                    style={{ color: PROVIDER_ICONS[provider.id] ?? "#ff8a00" }}
                  >
                    <HugeiconsIcon icon={TerminalIcon} size={18} />
                  </span>
                  <span className="remote-provider-info">
                    <strong>{provider.name}</strong>
                    <small>{provider.description}</small>
                  </span>
                  <span className="remote-provider-add-group">
                    {provider.installUrl ? (
                      <a
                        className="remote-provider-install"
                        href={provider.installUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Install instructions
                      </a>
                    ) : null}
                    <button type="button" className="remote-provider-add">
                      Add
                    </button>
                  </span>
                </div>
              ))}
              {available.length === 0 ? (
                <p className="remote-providers-message">No matching providers.</p>
              ) : null}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function ProvidersHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="remote-providers-header">
      <button type="button" className="remote-providers-back" aria-label="Back" onClick={onBack}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
      </button>
      <h1>Providers</h1>
      <span className="remote-providers-header-spacer" />
    </header>
  );
}
