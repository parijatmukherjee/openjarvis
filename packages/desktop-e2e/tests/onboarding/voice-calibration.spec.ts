import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Voice calibration", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("[data-testid='onboarding-initialize']").click();
    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
    await page.locator("[data-testid='onboarding-continue']").click();
    await expect(page.getByRole("heading", { name: /voice calibration/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows start calibration button", async ({ page }) => {
    await expect(page.locator("[data-testid='voice-start']")).toBeVisible({ timeout: 5_000 });
  });

  test("start calibration shows progress then continue button", async ({ page }) => {
    await page.click("[data-testid='voice-start']");
    await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
  });

  test("clicking Continue advances to agent selection", async ({ page }) => {
    await page.click("[data-testid='voice-start']");
    await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
    await page.click("[data-testid='voice-continue']");
    await expect(page.getByText("Research").first()).toBeVisible({ timeout: 10_000 });
  });
});
