import { test, expect, completeOnboarding } from "../../fixtures/electron-app.js";

test.describe("Dashboard layout", () => {
  test("renders all left panel buttons after onboarding", async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.locator("[data-testid='btn-workboard']")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[data-testid='btn-agents']")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[data-testid='btn-voice']")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[data-testid='btn-settings']")).toBeVisible({ timeout: 5_000 });
  });

  test("renders chat input after onboarding", async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.locator("[data-testid='chat-input']")).toBeVisible({ timeout: 10_000 });
  });

  test("renders chat header", async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByText("COM_LINK")).toBeVisible({ timeout: 10_000 });
  });
});
