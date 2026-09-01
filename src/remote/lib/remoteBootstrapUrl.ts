export function readRemoteBootstrapSecretFromUrl(url: URL): string {
  const hashParams = new URLSearchParams(url.hash.slice(1));
  const pathMatch = url.pathname.match(/^\/setup\/([^/]+)\/?$/);
  let pathSecret = "";
  if (pathMatch?.[1]) {
    try {
      pathSecret = decodeURIComponent(pathMatch[1]);
    } catch {
      pathSecret = "";
    }
  }
  return (
    pathSecret ||
    url.searchParams.get("bootstrap") ||
    hashParams.get("bootstrap") ||
    ""
  );
}

export function scrubRemoteBootstrapUrl(url: URL): string {
  url.pathname = "/";
  url.searchParams.delete("bootstrap");
  url.hash = "";
  return `${url.pathname}${url.search}${url.hash}`;
}
