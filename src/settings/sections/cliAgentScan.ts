type CliAgentScanner = (names: readonly string[]) => Promise<boolean[]>;

let cachedNames: string | null = null;
let cachedResult: boolean[] | null = null;
let pendingScan: Promise<boolean[]> | null = null;

export function checkInstalledCliAgents(
  names: readonly string[],
  scan: CliAgentScanner,
  forceRefresh = false,
): Promise<boolean[]> {
  const namesKey = JSON.stringify(names);
  if (!forceRefresh && namesKey === cachedNames) {
    if (cachedResult) return Promise.resolve(cachedResult);
    if (pendingScan) return pendingScan;
  }

  cachedNames = namesKey;
  cachedResult = null;
  const request = scan(names).then(
    (result) => {
      cachedResult = result;
      pendingScan = null;
      return result;
    },
    (error) => {
      cachedNames = null;
      pendingScan = null;
      throw error;
    },
  );
  pendingScan = request;
  return request;
}

export function resetCliAgentScanCacheForTests(): void {
  cachedNames = null;
  cachedResult = null;
  pendingScan = null;
}
