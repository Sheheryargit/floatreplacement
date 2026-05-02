/** Greedy lane assignment for overlapping [start, start+span) intervals. Mutates segments with .stack. */
export function assignAllocationStackLevels(segments) {
  const hoursOf = (seg) => Math.max(0, parseFloat(seg?.a?.hoursPerDay) || 0);
  const sorted = [...segments].sort((a, b) => {
    const ha = hoursOf(a);
    const hb = hoursOf(b);
    if (ha !== hb) return ha - hb;
    if (a.start !== b.start) return a.start - b.start;
    return b.span - a.span;
  });
  const laneEnds = [];
  for (const seg of sorted) {
    const s = seg.start;
    const e = seg.start + seg.span;
    let placed = false;
    for (let k = 0; k < laneEnds.length; k++) {
      if (laneEnds[k] <= s + 1e-9) {
        seg.stack = k;
        laneEnds[k] = e;
        placed = true;
        break;
      }
    }
    if (!placed) {
      seg.stack = laneEnds.length;
      laneEnds.push(e);
    }
  }
}

// --- ISO week stacking (Float-style): every piece in the same work-week gets its own lane top→bottom ---

function dateFromKey(key) {
  const parts = String(key).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return new Date(NaN);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

function dateKeyLocal(dt) {
  const x = new Date(dt);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekMondayKeyFromDateKey(dateKey) {
  const dt = dateFromKey(dateKey);
  if (Number.isNaN(dt.getTime())) return "";
  return dateKeyLocal(startOfWeekMonday(dt));
}

/**
 * Float-like stacking: each allocation segment is already split to at most one ISO work-week
 * (`splitLayoutByWorkWeek`). Within a week, every segment gets a distinct vertical lane (top → bottom),
 * including tasks on different weekdays — not only when columns overlap.
 *
 * Order within a week: lower hours/day nearer the top (matches common Float exports), then earlier
 * `start`, then longer `span`, then project label.
 *
 * @param {Array<{ lay: { start: number, span: number }, a: { hoursPerDay?: number, project?: string, notes?: string }, start?: number, span?: number }>} segments
 * @param {{ slots: Array<{ dateKey: string }> }} scheduleModel
 */
export function assignAllocationStackLevelsByWorkWeek(segments, scheduleModel) {
  if (!segments?.length) return;
  if (!scheduleModel?.slots?.length) {
    assignAllocationStackLevels(segments);
    return;
  }

  const slots = scheduleModel.slots;
  const hoursOf = (seg) => Math.max(0, parseFloat(seg?.a?.hoursPerDay) || 0);
  const startCol = (seg) => Math.max(0, Math.floor(seg?.lay?.start ?? seg?.start ?? 0));
  const spanCol = (seg) => Math.max(0, Math.floor(seg?.lay?.span ?? seg?.span ?? 0));
  const projectTie = (seg) => String(seg?.a?.project || seg?.a?.notes || "").trim().toLowerCase();

  const byWeek = new Map();
  for (const seg of segments) {
    const i0 = startCol(seg);
    const dk = slots[i0]?.dateKey;
    const wk = dk ? weekMondayKeyFromDateKey(dk) : "";
    const key = wk || "__fallback__";
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(seg);
  }

  for (const [wkKey, group] of byWeek) {
    if (wkKey === "__fallback__") {
      assignAllocationStackLevels(group);
      continue;
    }
    group.sort((a, b) => {
      const ha = hoursOf(a);
      const hb = hoursOf(b);
      if (ha !== hb) return ha - hb;
      const sa = startCol(a);
      const sb = startCol(b);
      if (sa !== sb) return sa - sb;
      const spa = spanCol(a);
      const spb = spanCol(b);
      if (spb !== spa) return spb - spa;
      return projectTie(a).localeCompare(projectTie(b));
    });
    group.forEach((seg, idx) => {
      seg.stack = idx;
    });
  }
}

