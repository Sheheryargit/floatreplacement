import { test, expect } from "@playwright/test";

test.describe("Schedule canvas stability", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  });

  test("Today keeps canvas and person names visible", async ({ page }) => {
    const viewport = page.locator(".lp-schedule-viewport");
    await viewport.evaluate((el) => {
      el.scrollTop = 2400;
      el.scrollLeft = 400;
    });
    await page.getByRole("button", { name: "Today" }).click();
    await expect(viewport).toBeVisible();
    await expect(page.locator(".lp-sched-virtual-anchor .lp-person-name").first()).toBeVisible();
    await expect(page.locator(".lp-sched-virtual-anchor .lp-block-alloc").first()).toBeVisible();
  });

  test("vertical scroll keeps person names visible", async ({ page }) => {
    const viewport = page.locator(".lp-schedule-viewport");
    await viewport.evaluate((el) => {
      el.scrollTop = 1800;
    });
    await expect(page.locator(".lp-sched-virtual-anchor .lp-person-name").first()).toBeVisible();
    await expect(page.locator(".lp-sched-virtual-anchor .lp-block-alloc").first()).toBeVisible();
  });
});

