import { describe, expect, it } from "vitest";

import {
  buildWorkerLaunchSpec,
  planWorkerLaunchSpecs,
} from "./orchestrationWorkerLaunch";

describe("buildWorkerLaunchSpec", () => {
  it("tags catalog providers with transports as structured", () => {
    const spec = buildWorkerLaunchSpec("codex");
    expect(spec.kind).toBe("structured");
    expect(spec.executable).toBeTruthy();
    expect(spec.argv[0]).toBe(spec.executable);
    expect(spec.launchCommand).toContain(spec.argv[0]);
  });

  it("tags providers without transports as manual", () => {
    const spec = buildWorkerLaunchSpec("copilot");
    expect(spec.kind).toBe("manual");
    expect(spec.argv).toEqual(["copilot"]);
  });

  it("falls back to the raw provider string when unknown", () => {
    const spec = buildWorkerLaunchSpec("some-future-cli");
    expect(spec.kind).toBe("manual");
    expect(spec.executable).toBe("some-future-cli");
    expect(spec.argv).toEqual(["some-future-cli"]);
  });

  it("splits quoted launch segments without breaking them", () => {
    const spec = buildWorkerLaunchSpec("codex");
    expect(spec.argv.length).toBeGreaterThan(0);
    expect(spec.argv.every((part) => part.length > 0)).toBe(true);
  });
});

describe("planWorkerLaunchSpecs", () => {
  it("plans one spec per provider in order", () => {
    const specs = planWorkerLaunchSpecs(["codex", "copilot"]);
    expect(specs.map((spec) => spec.provider)).toEqual(["codex", "copilot"]);
    expect(specs.map((spec) => spec.kind)).toEqual(["structured", "manual"]);
  });
});
