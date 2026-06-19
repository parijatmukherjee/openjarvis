import { test, expect } from "../../fixtures/electron-app.js";

test.describe("weather skill (via bridge)", () => {
  test("executes weather_current intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("weather_current", { location: "San Francisco" });
        b.simulateIntentResponse(
          "weather_current",
          "It's 72°F and sunny in San Francisco."
        );
      }
    });
    await expect(
      page.getByText(/72°F|sunny|San Francisco/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});