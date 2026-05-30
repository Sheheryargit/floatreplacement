/** Deep-clone workspace entities for pre-test snapshot / offline restore. */
function cloneEntityList(list) {
  return (list || []).map((row) => {
    const copy = { ...row };
    if (Array.isArray(row.tags)) copy.tags = [...row.tags];
    if (Array.isArray(row.teamIds)) copy.teamIds = [...row.teamIds];
    if (Array.isArray(row.personIds)) copy.personIds = [...row.personIds];
    return copy;
  });
}

export function captureWorkspaceSnapshot(state) {
  return {
    people: cloneEntityList(state.people),
    projects: cloneEntityList(state.projects),
    allocations: cloneEntityList(state.allocations),
  };
}

/** Zustand patch to restore a captured snapshot (offline / fallback). */
export function workspaceSnapshotStorePatch(snapshot) {
  if (!snapshot) return {};
  return {
    people: cloneEntityList(snapshot.people),
    projects: cloneEntityList(snapshot.projects),
    allocations: cloneEntityList(snapshot.allocations),
  };
}
