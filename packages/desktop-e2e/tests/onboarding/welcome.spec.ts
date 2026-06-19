import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Welcome screen", () => {
  test("renders the JARVIS title", async ({ page }) => {
    await expect(page.getByText(/jarvis/i)).toBeVisible({ timeout: 10_000 });
  });

  test("renders the Initialize button", async ({ page }) => {
    await expect(page.locator("[data-testid='onboarding-initialize']")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking Initialize advances to locale setup", async ({ page }) => {
    await page.locator("[data-testid='onboarding-initialize']").click();
    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});