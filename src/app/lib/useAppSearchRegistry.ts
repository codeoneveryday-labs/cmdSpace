import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { SearchAddon } from "@xterm/addon-search";

export function useAppSearchRegistry({
  activeId,
  activeLeafId,
  searchAddons,
  setActiveSearchAddon,
}: {
  activeId: number;
  activeLeafId: number | null;
  searchAddons: MutableRefObject<Map<number, SearchAddon>>;
  setActiveSearchAddon: Dispatch<SetStateAction<SearchAddon | null>>;
}) {
  useEffect(() => {
    setActiveSearchAddon(
      activeLeafId !== null
        ? (searchAddons.current.get(activeLeafId) ?? null)
        : null,
    );
  }, [activeId, activeLeafId, searchAddons, setActiveSearchAddon]);

  const handleSearchReady = useCallback(
    (leafId: number, addon: SearchAddon) => {
      searchAddons.current.set(leafId, addon);
      if (leafId === activeLeafId) setActiveSearchAddon(addon);
    },
    [activeLeafId, searchAddons, setActiveSearchAddon],
  );

  return { handleSearchReady };
}
