/** Resolve natural-language entities against live workspace data. */

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}

function scoreMatch(query, candidate) {
  const q = norm(query);
  const c = norm(candidate);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 85;
  if (c.includes(q) || q.includes(c)) return 70;
  const qParts = q.split(/\s+/).filter(Boolean);
  const hits = qParts.filter((p) => c.includes(p)).length;
  return hits > 0 ? 40 + hits * 15 : 0;
}

export function resolvePerson(query, people = []) {
  const active = people.filter((p) => !p.archived);
  const scored = active
    .map((p) => ({ person: p, score: scoreMatch(query, p.name) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { ok: false, error: `No person matching "${query}".` };
  if (scored.length > 1 && scored[0].score - scored[1].score < 15) {
    return {
      ok: false,
      ambiguous: true,
      options: scored.slice(0, 4).map((x) => ({ id: x.person.id, name: x.person.name })),
      error: `Multiple people match "${query}".`,
    };
  }
  return { ok: true, person: scored[0].person };
}

export function resolveProject(query, projects = [], extraLabels = []) {
  const labels = new Set();
  for (const p of projects) {
    if (p.name) labels.add(p.name);
    if (p.code) labels.add(p.code);
  }
  for (const l of extraLabels) labels.add(l);

  const scored = [...labels]
    .map((label) => ({ label, score: scoreMatch(query, label) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { ok: true, project: String(query).trim(), created: false };
  }
  return { ok: true, project: scored[0].label, created: false };
}

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIso(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** Parse "5 june to 30 june" or "5 jun - 30 jun 2026" */
export function parseDateRange(text, defaultYear) {
  const t = String(text || "").toLowerCase();
  const yearMatch = t.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : defaultYear || new Date().getFullYear();

  const rangeMatch = t.match(
    /(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:to|–|-|through)\s*(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i
  );
  if (!rangeMatch) return { ok: false, error: "Could not parse the date range." };

  const d1 = Number(rangeMatch[1]);
  const m1 = MONTHS[rangeMatch[2].slice(0, 3)] ?? MONTHS[rangeMatch[2]];
  const d2 = Number(rangeMatch[3]);
  const m2 = MONTHS[rangeMatch[4].slice(0, 3)] ?? MONTHS[rangeMatch[4]];

  if (m1 == null || m2 == null) return { ok: false, error: "Could not parse month names." };

  return {
    ok: true,
    startDate: toIso(year, m1, d1),
    endDate: toIso(year, m2, d2),
  };
}

export function parseHoursPerDay(text) {
  const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\s*(?:\/|per\s*)?\s*day/i);
  if (m) return Number(m[1]);
  const m2 = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i);
  if (m2) return Number(m2[1]);
  return null;
}

export function parseAllocationCount(text) {
  const m = String(text || "").match(/\b(\d+)\s+allocations?\b/i);
  return m ? Math.min(Number(m[1]), 5) : 1;
}
