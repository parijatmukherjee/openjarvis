import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Settings panel", () => {
  test("opens settings from window controls and shows theme toggle", async ({ page }) => {
    const settingsBtn =
      page.getByRole("button", { name: /settings|preferences/i }) ??
      page.locator("[data-testid='settings-button']");
    await settingsBtn.click();
    await expect(page.getByText(/theme|dark|light/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
