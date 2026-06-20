import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Completion screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("[data-testid='onboarding-initialize']").click();
    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
    await page.locator("[data-testid='onboarding-continue']").click();
    await expect(page.getByRole("heading", { name: /voice calibration/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator("[data-testid='voice-start']").click();
    await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
    await page.locator("[data-testid='voice-continue']").click();
    await page.locator("[data-testid='onboarding-continue']").click();
  });

  test("displays the Ready screen", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Launch Dashboard shows the dashboard", async ({ page }) => {
    await page.locator("[data-testid='onboarding-launch']").click();
    await expect(page.locator("[data-testid='btn-settings']")).toBeVisible({ timeout: 10_000 });
  });
});
