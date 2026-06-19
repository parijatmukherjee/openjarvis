import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Nexus bridge integration", () => {
  test("bridge data renders in dashboard", async ({ page }) => {
    await expect(page.getByText(/research|weather/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("bridge intent execution logs correctly", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("weather_current", { location: "NYC" });
        b.simulateIntentResponse(
          "weather_current",
          "65°F and cloudy in NYC"
        );
      }
    });
    await expect(page.getByText(/65°F|NYC/i)).toBeVisible({ timeout: 5_000 });
  });

  test("bridge error handling displays error message", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            simulateError: (e: string) => void;
          }
        | undefined;
      if (b && typeof b.simulateError === "function") {
        b.simulateError("Connection lost");
      }
    });
    await expect(page.getByText(/error|connection lost/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});