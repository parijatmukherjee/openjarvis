import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Telegram channel (via bridge)", () => {
  test("executes telegram_send intent through conversation", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("telegram_send", {
          chat: "12345",
          message: "Hello from JARVIS",
        });
        b.simulateIntentResponse(
          "telegram_send",
          "Message sent to Telegram chat 12345"
        );
      }
    });
    await expect(page.getByText(/telegram|sent/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});