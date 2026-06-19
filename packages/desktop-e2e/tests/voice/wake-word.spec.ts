import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Wake word detection", () => {
  test("renders voice waveform component", async ({ page }) => {
    await expect(page.getByText(/voice|wave|listen/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
