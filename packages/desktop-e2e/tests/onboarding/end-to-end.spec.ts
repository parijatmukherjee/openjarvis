import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Onboarding — end-to-end flow", () => {
  test("completes all onboarding steps and reaches dashboard", async ({ page }) => {
    await page.waitForSelector("[data-testid='onboarding-initialize']", { timeout: 30_000 });
    await page.click("[data-testid='onboarding-initialize']");

    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
    await page.click("[data-testid='onboarding-continue']");

    await expect(page.locator("[data-testid='voice-start']")).toBeVisible({ timeout: 10_000 });
    await page.click("[data-testid='voice-start']");
    await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
    await page.click("[data-testid='voice-continue']");

    await expect(page.getByText("Research").first()).toBeVisible({ timeout: 10_000 });
    await page.click("[data-testid='onboarding-continue']");

    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible({ timeout: 10_000 });
    await page.click("[data-testid='onboarding-launch']");

    await expect(page.locator("[data-testid='btn-settings']")).toBeVisible({ timeout: 10_000 });
  });
});
