import type { RemotePairedDeviceStatus } from "@/modules/settings/remoteAccess";

export type RemoteDeviceGroup = {
  displayName: string;
  devices: RemotePairedDeviceStatus[];
};

export function groupRemoteDevices(
  devices: readonly RemotePairedDeviceStatus[],
): RemoteDeviceGroup[] {
  const groups = new Map<string, RemotePairedDeviceStatus[]>();
  for (const device of devices) {
    const group = groups.get(device.displayName);
    if (group) group.push(device);
    else groups.set(device.displayName, [device]);
  }
  return [...groups].map(([displayName, groupedDevices]) => ({
    displayName,
    devices: groupedDevices,
  }));
}
