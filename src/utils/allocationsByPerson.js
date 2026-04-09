/** Stable empty list — never mutate. */
export const EMPTY_PERSON_ALLOCATIONS = Object.freeze([]);

/**
 * Map person id (string key) → allocations touching that person (shared array refs per person).
 * @param {Array<{ personIds?: string[], personId?: string }>} allocations
 * @returns {Map<string, object[]>}
 */
export function buildAllocationsByPerson(allocations) {
  const m = new Map();
  if (!Array.isArray(allocations) || allocations.length === 0) return m;
  for (const a of allocations) {
    const ids =
      Array.isArray(a.personIds) && a.personIds.length > 0
        ? a.personIds
        : a.personId != null
          ? [a.personId]
          : [];
    for (const pid of ids) {
      const k = String(pid);
      let arr = m.get(k);
      if (!arr) {
        arr = [];
        m.set(k, arr);
      }
      arr.push(a);
    }
  }
  return m;
}

export function getPersonAllocations(byPerson, personId) {
  return byPerson.get(String(personId)) ?? EMPTY_PERSON_ALLOCATIONS;
}
