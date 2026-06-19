import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Conversation panel", () => {
  test("displays messages from the bridge", async ({ page }) => {
    await expect(page.getByText(/weather/i)).toBeVisible({ timeout: 10_000 });
  });
});