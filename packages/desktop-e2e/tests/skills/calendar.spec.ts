import { test, expect } from "../../fixtures/electron-app.js";

test.describe("calendar skill (via bridge)", () => {
  test("executes calendar_list intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("calendar_list", { date: "2025-01-15" });
        b.simulateIntentResponse("calendar_list", "3 events on January 15, 2025");
      }
    });
    await expect(page.getByText(/event/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes calendar_create intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("calendar_create", {
          title: "Team standup",
          date: "2025-01-16T10:00:00",
        });
        b.simulateIntentResponse("calendar_create", 'Event "Team standup" created');
      }
    });
    await expect(page.getByText(/team standup|event.*created/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
