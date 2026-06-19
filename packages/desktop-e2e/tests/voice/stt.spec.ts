import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Speech-to-text UI", () => {
  test("renders voice input UI", async ({ page }) => {
    await expect(
      page.getByText(/voice|mic|speak|microphone/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});