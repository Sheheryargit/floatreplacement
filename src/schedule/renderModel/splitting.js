export function splitLayoutByOffDays(lay, scheduleModel, offDayColSet) {
  if (!lay || !scheduleModel?.slots?.length) return [];
  const i0 = Math.max(0, Math.floor(lay.start || 0));
  const i1 = Math.min(
    scheduleModel.slots.length - 1,
    i0 + Math.max(0, Math.floor(lay.span || 0)) - 1
  );
  if (i1 < i0) return [];

  const pieces = [];
  let curStart = null;
  let curEnd = null;

  for (let idx = i0; idx <= i1; idx++) {
    const isOff = offDayColSet?.has?.(idx) === true;
    if (isOff) {
      if (curStart != null && curEnd != null && curEnd >= curStart) {
        pieces.push({ start: curStart, span: curEnd - curStart + 1 });
      }
      curStart = null;
      curEnd = null;
      continue;
    }
    if (curStart == null) {
      curStart = idx;
      curEnd = idx;
    } else {
      curEnd = idx;
    }
  }

  if (curStart != null && curEnd != null && curEnd >= curStart) {
    pieces.push({ start: curStart, span: curEnd - curStart + 1 });
  }

  return pieces;
}

