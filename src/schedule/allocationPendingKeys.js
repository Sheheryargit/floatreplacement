/** Pipe-joined allocation ids currently saving (optimistic UI). */

export function parsePendingAllocationKeys(key) {
  return new Set(String(key || "").split("|").filter(Boolean));
}

export function addPendingAllocationKey(key, id) {
  const sid = String(id || "");
  if (!sid) return key || "";
  const s = parsePendingAllocationKeys(key);
  s.add(sid);
  return [...s].sort().join("|");
}

export function removePendingAllocationKey(key, id) {
  const sid = String(id || "");
  if (!sid) return key || "";
  const s = parsePendingAllocationKeys(key);
  s.delete(sid);
  return [...s].sort().join("|");
}

export function replacePendingAllocationKey(key, fromId, toId) {
  const from = String(fromId || "");
  const to = String(toId || "");
  if (!from) return key || "";
  let next = removePendingAllocationKey(key, from);
  if (to && to !== from) next = addPendingAllocationKey(next, to);
  return next;
}
