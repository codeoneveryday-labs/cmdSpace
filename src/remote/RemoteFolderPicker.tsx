import {
  ArrowRight01Icon,
  File01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { remoteApiPath, remoteFolderName } from "./lib/remoteUtils";
import {
  getRemoteFolderView,
  type RemoteFolderState,
} from "./lib/remoteFolderPickerModel";

export type {
  RemoteFile,
  RemoteFolder,
  RemoteFolderState,
} from "./lib/remoteFolderPickerModel";

function remoteAuthorizationHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

type RemoteFolderPickerProps = {
  authToken: string;
  onUnauthorized: () => void;
  onSelect: (path: string) => void;
  onBack?: () => void;
};

export function RemoteFolderPicker({
  authToken,
  onUnauthorized,
  onSelect,
  onBack,
}: RemoteFolderPickerProps) {
  const [folderState, setFolderState] = useState<RemoteFolderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const folderCacheRef = useRef(new Map<string, RemoteFolderState>());

  const load = useCallback((path?: string) => {
    requestRef.current?.abort();
    setSearchQuery("");
    if (path) {
      const cached = folderCacheRef.current.get(path);
      if (cached) {
        setFolderState(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setFolderState((current) =>
        current ? { ...current, current: path, folders: [], files: [] } : current,
      );
    }
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setError(null);
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    void fetch(remoteApiPath(`/api/remote/folders${query}`), {
      cache: "no-store",
      headers: remoteAuthorizationHeaders(authToken),
      signal: request.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          onUnauthorized();
          throw new Error("Remote access expired");
        }
        if (!response.ok) throw new Error((await response.text()) || "Folder load failed");
        return response.json() as Promise<RemoteFolderState>;
      })
      .then((state) => {
        folderCacheRef.current.set(state.current, state);
        if (requestRef.current === request) setFolderState(state);
      })
      .catch((reason) => {
        if (
          requestRef.current === request &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setError(String(reason));
        }
      })
      .finally(() => {
        if (requestRef.current === request) setLoading(false);
      });
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  const folderView = useMemo(
    () => getRemoteFolderView(folderState, searchQuery),
    [folderState, searchQuery],
  );
  const {
    normalizedSearch,
    folders: filteredFolders,
    files: filteredFiles,
    isEmpty: isFilteredViewEmpty,
  } = folderView;

  return (
    <main className="remote-folder-picker">
      <header className="remote-folder-header">
        <div>
          <button
            type="button"
            disabled={(!folderState?.parent && !onBack) || loading}
            onClick={() => {
              if (folderState?.parent) {
                load(folderState.parent);
              } else {
                onBack?.();
              }
            }}
            aria-label={folderState?.parent ? "Go to parent folder" : "Back to home"}
          >←</button>
          <span>
            <strong>{folderState ? remoteFolderName(folderState.current) : "Browse this Mac"}</strong>
            <small>{folderState?.current ?? "Loading folders…"}</small>
          </span>
        </div>
        <label className="remote-folder-search">
          <span>⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search this folder"
            aria-label="Search folders and files"
          />
        </label>
      </header>

      <section className="remote-folder-picker-scroll">
        <div className="remote-folder-list">
          {loading ? <div className="remote-folder-message">Loading folders from desktop…</div> : null}
          {error ? (
            <div className="remote-folder-message remote-folder-error">
              <p>{error}</p>
              <button type="button" onClick={() => load(folderState?.current)}>Try again</button>
            </div>
          ) : null}
          {!error && folderState && !loading ? (
            <>
              {filteredFolders.map((folder) => (
                <button key={folder.path} type="button" onClick={() => load(folder.path)}>
                  <span className="remote-folder-icon"><HugeiconsIcon icon={Folder01Icon} size={20} /></span>
                  <strong>{folder.name}</strong>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={17} />
                </button>
              ))}
              {filteredFiles.map((file) => (
                <button key={file.path} type="button" onClick={() => onSelect(file.parent)}>
                  <span className="remote-folder-icon"><HugeiconsIcon icon={File01Icon} size={19} /></span>
                  <strong>{file.name}</strong>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={17} />
                </button>
              ))}
              {isFilteredViewEmpty ? (
                <div className="remote-folder-message">
                  {normalizedSearch ? "No matching folders or files." : "This folder is empty."}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <footer className="remote-folder-footer">
        <span>
          <small>Terminal location</small>
          <strong>{folderState?.current ?? "No folder selected"}</strong>
        </span>
        <button type="button" disabled={!folderState || loading} onClick={() => folderState && onSelect(folderState.current)}>
          Open current folder
        </button>
      </footer>
    </main>
  );
}
