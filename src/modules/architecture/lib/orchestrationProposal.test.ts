import { describe, expect, it } from "vitest";
import {
  extractOrchestrationProposal,
  parseOrchestrationManifestJson,
} from "./orchestrationProposal";

describe("extractOrchestrationProposal", () => {
  it("extracts and validates a tagged orchestrator manifest", () => {
    const proposal = extractOrchestrationProposal(`I propose this graph.
<cmdspace-orchestration>
{"version":1,"title":"Ship","goal":"Ship","orchestrator":{"provider":"codex"},"agents":[{"id":"builder","name":"Builder","role":"Implementation","provider":"codex"}],"tasks":[{"id":"build","title":"Build","instructions":"Implement","assigneeId":"builder","dependsOn":[],"writeAccess":true,"doneWhen":"Tests pass","validationCommands":["pnpm test"]}]}
</cmdspace-orchestration>`);

    expect(proposal).toMatchObject({ title: "Ship", tasks: [{ id: "build" }] });
  });

  it("rejects output without one valid tagged manifest", () => {
    expect(() => extractOrchestrationProposal("No structured proposal")).toThrow(
      "Orchestrator response did not include a tagged manifest",
    );
  });

  it("validates a user-edited draft manifest before a revision is saved", () => {
    expect(
      parseOrchestrationManifestJson(
        '{"version":1,"title":"Ship","goal":"Ship","orchestrator":{"provider":"codex"},"agents":[{"id":"builder","name":"Builder","role":"Implementation","provider":"codex"}],"tasks":[{"id":"build","title":"Build","instructions":"Implement","assigneeId":"builder","dependsOn":[],"writeAccess":true,"doneWhen":"Tests pass","validationCommands":[]}]}',
      ),
    ).toMatchObject({ title: "Ship" });
  });
});
