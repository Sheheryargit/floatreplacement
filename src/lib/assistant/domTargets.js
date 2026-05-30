/** Resolve live DOM nodes on the schedule without modifying page components. */

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

export function findPersonRowByName(personName) {
  if (!personName || typeof document === "undefined") return null;
  const q = norm(personName);
  let best = null;
  let bestScore = 0;
  for (const el of document.querySelectorAll(".lp-person-name")) {
    const score = scoreMatch(q, el.textContent || "");
    if (score > bestScore) {
      bestScore = score;
      best = el.closest(".lp-sched-row");
    }
  }
  return bestScore >= 40 ? best : null;
}

export function findPersonAddControl(personName) {
  const row = findPersonRowByName(personName);
  if (!row) return null;
  return (
    row.querySelector(".lp-person-add-banner button") ||
    row.querySelector(".lp-person-add-banner") ||
    row.querySelector(".lp-person-identity-hit")
  );
}

export function findScheduleAddFab() {
  return (
    document.querySelector('[data-alloc8-guide="schedule-add-menu"]') ||
    document.querySelector(".lp-add-fab") ||
    document.querySelector(".lp-header-add") ||
    document.querySelector('button[aria-label*="Add allocation"]')
  );
}

export function findAllocationBar({ personName, project, startDate }) {
  const row = findPersonRowByName(personName);
  if (!row) return null;
  const proj = norm(project);
  const bars = row.querySelectorAll(".lp-alloc-bar");
  for (const bar of bars) {
    const text = bar.textContent || "";
    const title = bar.getAttribute("title") || "";
    const hay = `${text} ${title}`.toLowerCase();
    if (proj && hay.includes(proj)) return bar;
    if (startDate && hay.includes(startDate)) return bar;
  }
  return bars[bars.length - 1] || null;
}

export function scrollTargetIntoView(el) {
  if (!el?.scrollIntoView) return;
  try {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  } catch {
    el.scrollIntoView(true);
  }
}

export function rectForElement(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return null;
  return {
    top: r.top + r.height / 2,
    left: r.left + r.width / 2,
    width: r.width,
    height: r.height,
    box: { top: r.top, left: r.left, width: r.width, height: r.height },
  };
}
