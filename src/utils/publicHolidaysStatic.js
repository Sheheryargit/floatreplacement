/** Load AU holiday JSON from `public/holidays/` (Vite). */

function jsonUrl(relativePath) {
  const base = import.meta.env.BASE_URL || "/";
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${b}${p}`;
}

function parseIsoDateBound(s) {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

/**
 * @param {Array<{ id: number, startDate?: string, endDate?: string, publicHolidayRegion?: string }>} people
 * @returns {Promise<Array<{ person_id: number, holiday_date: string, name: string, holiday_type: string }>>}
 */
export async function buildPublicHolidayRowsFromStaticJson(people) {
  const withRegion = (people || []).filter((p) => {
    const r = p.publicHolidayRegion != null ? String(p.publicHolidayRegion).trim() : "";
    return r !== "" && r.toLowerCase() !== "none";
  });
  if (withRegion.length === 0) return [];

  const y0 = new Date().getFullYear();
  const y1 = y0 + 1;
  const nationalByYear = new Map();
  const statesByYear = new Map();

  for (const y of [y0, y1]) {
    try {
      const [natRes, stRes] = await Promise.all([
        fetch(jsonUrl(`holidays/AU-${y}-national.json`)),
        fetch(jsonUrl(`holidays/AU-${y}-states.json`)),
      ]);
      if (!natRes.ok || !stRes.ok) continue;
      nationalByYear.set(y, await natRes.json());
      statesByYear.set(y, await stRes.json());
    } catch {
      /* ignore missing files / network */
    }
  }

  const rows = [];

  for (const p of withRegion) {
    const pid = Number(p.id);
    if (!Number.isFinite(pid)) continue;
    const region = String(p.publicHolidayRegion).trim();
    const dStart = parseIsoDateBound(p.startDate);
    const dEnd = parseIsoDateBound(p.endDate);

    for (const y of [y0, y1]) {
      const national = nationalByYear.get(y);
      const states = statesByYear.get(y);
      if (!national || !states) continue;

      const seen = new Set();
      const addHoliday = (h) => {
        const dk = h?.date?.slice(0, 10);
        if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
        if (dStart && dk < dStart) return;
        if (dEnd && dk > dEnd) return;
        const name = (h.name || h.localName || "Public holiday").trim() || "Public holiday";
        const key = `${dk}\0${name}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          person_id: pid,
          holiday_date: dk,
          name,
          holiday_type: "Public",
        });
      };

      for (const h of national) addHoliday(h);

      if (region !== "AU") {
        const stateList = states[region];
        if (Array.isArray(stateList)) {
          for (const h of stateList) addHoliday(h);
        }
      }
    }
  }

  rows.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  return rows;
}
