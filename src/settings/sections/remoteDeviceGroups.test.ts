import { describe, expect, it } from "vitest";
import { groupRemoteDevices } from "./remoteDeviceGroups";

describe("groupRemoteDevices", () => {
  it("groups distinct identities with the same display name", () => {
    const groups = groupRemoteDevices([
      { id: "phone-one", displayName: "Boji iPhone", revoked: false },
      { id: "phone-two", displayName: "Boji iPhone", revoked: false },
      { id: "ipad-one", displayName: "Boji iPad", revoked: false },
    ]);

    expect(groups).toEqual([
      {
        displayName: "Boji iPhone",
        devices: [
          { id: "phone-one", displayName: "Boji iPhone", revoked: false },
          { id: "phone-two", displayName: "Boji iPhone", revoked: false },
        ],
      },
      {
        displayName: "Boji iPad",
        devices: [{ id: "ipad-one", displayName: "Boji iPad", revoked: false }],
      },
    ]);
  });
});
