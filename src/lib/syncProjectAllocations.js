import { useAppStore } from "../context/AppDataContext.jsx";
import { projectToAllocationLabel } from "../utils/projectColors.js";

/**
 * @param {{ id: string | number, name?: string, code?: string, color?: string }} project
 * @param {{ id: string | number, name?: string, code?: string } | null | undefined} [previousProject]
 */
export function patchAllocationsForProjectUpdate(project, previousProject) {
  const newLabel = projectToAllocationLabel(project);
  const prevLabel = previousProject ? projectToAllocationLabel(previousProject) : "";
  const pid = String(project.id);
  const color =
    project.color && /^#([0-9A-Fa-f]{6})$/i.test(String(project.color).trim())
      ? String(project.color).trim()
      : undefined;

  const relabel = (a) => {
    if (!a || a.isLeave) return a;
    const matchId =
      a.projectId != null && String(a.projectId).trim() !== "" && String(a.projectId) === pid;
    const matchLabel = prevLabel && String(a.project || "").trim() === prevLabel;
    if (!matchId && !matchLabel) return a;
    return {
      ...a,
      project: newLabel,
      projectId: a.projectId != null && String(a.projectId).trim() !== "" ? a.projectId : project.id,
      ...(color ? { projectColor: color } : {}),
    };
  };

  useAppStore.setState((s) => ({
    allocations: s.allocations.map(relabel),
    publicHolidayAllocations: (s.publicHolidayAllocations || []).map(relabel),
  }));
}
