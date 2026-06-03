import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocationProjectDisplay,
  parseAllocationProjectLabel,
  projectToAllocationLabel,
} from "./projectColors.js";

describe("allocationProjectDisplay", () => {
  const projects = [
    { id: "p1", name: "Alpha Build", code: "ALP", color: "#112233" },
    { id: "p2", name: "Beta", code: "", color: "#445566" },
  ];

  it("uses live registry name/code when projectId is set", () => {
    const out = allocationProjectDisplay(
      { projectId: "p1", project: "OLD / Stale Name", hoursPerDay: 8 },
      projects
    );
    assert.equal(out.projectName, "Alpha Build");
    assert.equal(out.projectCode, "ALP");
    assert.equal(out.hoursLabel, "8h");
  });

  it("matches by stored label when projectId is missing", () => {
    const label = projectToAllocationLabel(projects[0]);
    const out = allocationProjectDisplay({ project: label, hoursPerDay: 4 }, projects);
    assert.equal(out.projectName, "Alpha Build");
    assert.equal(out.projectCode, "ALP");
  });

  it("parses legacy label strings", () => {
    assert.deepEqual(parseAllocationProjectLabel("ARTC / Network Upgrade"), {
      projectName: "Network Upgrade",
      projectCode: "ARTC",
    });
    const out = allocationProjectDisplay({ project: "ARTC / Network Upgrade", hoursPerDay: 2 }, []);
    assert.equal(out.projectCode, "ARTC");
    assert.equal(out.projectName, "Network Upgrade");
  });
});
