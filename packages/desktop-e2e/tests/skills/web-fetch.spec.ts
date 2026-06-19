import { test, expect } from "../../fixtures/electron-app.js";

test.describe("web_fetch skill (via bridge)", () => {
  test("executes web_fetch intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("web_fetch", { url: "https://example.com" });
        b.simulateIntentResponse(
          "web_fetch",
          "Fetched content from https://example.com"
        );
      }
    });
    await expect(page.getByText(/fetched|example\.com/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});