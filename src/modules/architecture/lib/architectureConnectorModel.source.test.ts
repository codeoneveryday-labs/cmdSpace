import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureConnectorModel.ts", import.meta.url),
  "utf8",
);

describe("architectureConnectorModel contract", () => {
  it("keeps connector handle snapping and geometry updates together", () => {
    expect(source).toContain("updateConnectorHandle");
    expect(source).toContain("connectorGeometry");
    expect(source).toContain("snapConnectorEndpoint");
    expect(source).toContain("CONNECTOR_SNAP_DISTANCE");
  });
});
