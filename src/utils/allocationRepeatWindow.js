/**
 * Advance a recurring allocation's [start, end] by one period (schedule UI + conflict checks).
 */
export function advanceRepeatWindow(startIso, endIso, repeatId) {
  if (!repeatId || repeatId === "none") return null;
  const s = new Date(`${startIso}T12:00:00`);
  const e = new Date(`${endIso}T12:00:00`);
  switch (repeatId) {
    case "weekly":
      s.setDate(s.getDate() + 7);
      e.setDate(e.getDate() + 7);
      break;
    case "every2weeks":
      s.setDate(s.getDate() + 14);
      e.setDate(e.getDate() + 14);
      break;
    case "every3weeks":
      s.setDate(s.getDate() + 21);
      e.setDate(e.getDate() + 21);
      break;
    case "every6weeks":
      s.setDate(s.getDate() + 42);
      e.setDate(e.getDate() + 42);
      break;
    case "monthly":
      s.setMonth(s.getMonth() + 1);
      e.setMonth(e.getMonth() + 1);
      break;
    case "every2months":
      s.setMonth(s.getMonth() + 2);
      e.setMonth(e.getMonth() + 2);
      break;
    case "every3months":
      s.setMonth(s.getMonth() + 3);
      e.setMonth(e.getMonth() + 3);
      break;
    case "every6months":
      s.setMonth(s.getMonth() + 6);
      e.setMonth(e.getMonth() + 6);
      break;
    case "yearly":
      s.setFullYear(s.getFullYear() + 1);
      e.setFullYear(e.getFullYear() + 1);
      break;
    default:
      return null;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const toIso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: toIso(s), end: toIso(e) };
}
