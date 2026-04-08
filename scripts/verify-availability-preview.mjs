/**
 * Lightweight checks that client preview matches documented DB rules (weekly_hours / working_days).
 * Run: node scripts/verify-availability-preview.mjs
 */
import assert from "node:assert/strict";
import { previewAvailabilityHours } from "../src/utils/availabilityPreview.js";

function assertClose(a, b, tol = 0.0001) {
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);
}

// FT: 37.5 h, all five days → 7.5 h/day
{
  const r = previewAvailabilityHours({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    weeklyHours: 37.5,
  });
  assert.equal(r.valid, true);
  assert.equal(r.workingDays, 5);
  assertClose(r.hoursPerDay, 7.5);
}

// Uncheck one day → 37.5 / 4
{
  const r = previewAvailabilityHours({
    mon: false,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    weeklyHours: 37.5,
  });
  assert.equal(r.workingDays, 4);
  assertClose(r.hoursPerDay, 9.375);
}

// PT-style: three days
{
  const r = previewAvailabilityHours({
    mon: true,
    tue: false,
    wed: true,
    thu: false,
    fri: true,
    weeklyHours: 30,
  });
  assert.equal(r.workingDays, 3);
  assertClose(r.hoursPerDay, 10);
}

// Edge: zero days
{
  const r = previewAvailabilityHours({
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    weeklyHours: 37.5,
  });
  assert.equal(r.valid, false);
}

console.log("verify-availability-preview: ok");
