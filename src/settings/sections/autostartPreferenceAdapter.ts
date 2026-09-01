type NativeAutostartPreferencePort = {
  isEnabled: () => Promise<boolean>;
  currentPreference: () => boolean | null;
  persist: (enabled: boolean) => Promise<void>;
};

type NativeAutostartTogglePort = {
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  persist: (enabled: boolean) => Promise<void>;
};

export async function synchronizeNativeAutostartPreference(
  port: NativeAutostartPreferencePort,
): Promise<boolean> {
  const enabled = await port.isEnabled();
  const currentPreference = port.currentPreference();
  if (currentPreference === null || enabled === currentPreference) return false;
  await port.persist(enabled);
  return true;
}

export async function setNativeAutostartEnabled(
  port: NativeAutostartTogglePort,
  enabled: boolean,
): Promise<void> {
  if (enabled) await port.enable();
  else await port.disable();
  await port.persist(enabled);
}
