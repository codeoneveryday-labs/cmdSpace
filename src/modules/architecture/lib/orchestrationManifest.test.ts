import { describe, expect, it } from "vitest";
import {
  createOrchestrationDraft,
  validateOrchestrationManifest,
  type OrchestrationManifestV1,
} from "./orchestrationManifest";

function validManifest(): OrchestrationManifestV1 {
  return {
    version: 1,
    title: "Ship Canvas orchestration",
    goal: "Build and verify the orchestration MVP",
    orchestrator: { provider: "codex" },
    agents: [
      { id: "builder", name: "Builder", role: "Implementation", provider: "claude" },
      { id: "reviewer", name: "Reviewer", role: "Verification", provider: "cmd" },
    ],
    tasks: [
      {
        id: "implement",
        title: "Implement",
        instructions: "Build the approved slice.",
        assigneeId: "builder",
        dependsOn: [],
        writeAccess: true,
        doneWhen: "Focused tests pass",
        validationCommands: ["pnpm test"],
      },
      {
        id: "review",
        title: "Review",
        instructions: "Review the implementation.",
        assigneeId: "reviewer",
        dependsOn: ["implement"],
        writeAccess: false,
        doneWhen: "Review report is complete",
        validationCommands: [],
      },
    ],
  };
}

describe("validateOrchestrationManifest", () => {
  it("creates a valid editable draft from a Canvas goal", () => {
    const draft = createOrchestrationDraft("Ship the Canvas workflow", "claude");

    expect(draft).toMatchObject({
      version: 1,
      title: "Ship the Canvas workflow",
      goal: "Ship the Canvas workflow",
      orchestrator: { provider: "claude" },
      agents: [{ id: "builder", provider: "claude" }],
      tasks: [{ id: "initial-task", assigneeId: "builder" }],
    });
    expect(validateOrchestrationManifest(draft)).toEqual({ valid: true });
  });

  it("accepts a valid approved graph", () => {
    expect(validateOrchestrationManifest(validManifest())).toEqual({ valid: true });
  });

  it("rejects unsupported providers and missing assignees", () => {
    const manifest = validManifest();
    manifest.agents[0]!.provider = "not-a-cli" as never;
    manifest.tasks[0]!.assigneeId = "missing";

    expect(validateOrchestrationManifest(manifest)).toEqual({
      valid: false,
      errors: [
        "Agent 'builder' uses unsupported provider 'not-a-cli'",
        "Task 'implement' references missing assignee 'missing'",
      ],
    });
  });

  it("accepts every CLI in the agent catalog", async () => {
    const { CLI_AGENT_IDS } = await import("@/modules/terminal/lib/cliAgents");
    for (const provider of CLI_AGENT_IDS) {
      const manifest = validManifest();
      manifest.orchestrator.provider = provider;
      manifest.agents[0]!.provider = provider;
      expect(validateOrchestrationManifest(manifest)).toEqual({ valid: true });
    }
  });

  it("rejects duplicate ids, empty commands, and dependency cycles", () => {
    const manifest = validManifest();
    manifest.agents.push({ ...manifest.agents[0]! });
    manifest.tasks[0]!.dependsOn = ["review"];
    manifest.tasks[0]!.validationCommands = ["   "];

    expect(validateOrchestrationManifest(manifest)).toEqual({
      valid: false,
      errors: [
        "Duplicate agent id 'builder'",
        "Task 'implement' contains an empty validation command",
        "Task graph contains a dependency cycle",
      ],
    });
  });
});
