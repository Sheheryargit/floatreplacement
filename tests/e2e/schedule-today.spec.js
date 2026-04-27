import { test, expect } from "@playwright/test";

test("Schedule: clicking Today keeps allocations canvas visible", async ({ page }) => {
  await page.goto("/");

  // Schedule page should be visible (auth gate bypassed by webServer env).
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

  // Click Today; app may reload as a safety fallback, so wait for navigation.
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.getByRole("button", { name: "Today" }).click(),
  ]);

  // Canvas should still be present post-jump.
  await expect(page.locator(".lp-schedule-viewport")).toBeVisible();
});

