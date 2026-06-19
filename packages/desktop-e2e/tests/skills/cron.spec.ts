import { test, expect } from "../../fixtures/electron-app.js";

test.describe("cron skill (via bridge)", () => {
  test("executes cron_schedule intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("cron_schedule", {
          schedule: "0 9 * * *",
          task: "weather_current",
        });
        b.simulateIntentResponse(
          "cron_schedule",
          "Scheduled weather_current at 0 9 * * *"
        );
      }
    });
    await expect(page.getByText(/scheduled|cron/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});