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

