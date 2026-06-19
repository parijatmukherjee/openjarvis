import { test, expect } from "../../fixtures/electron-app.js";

test.describe("email skill (via bridge)", () => {
  test("executes email_search intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("email_search", { query: "meeting" });
        b.simulateIntentResponse(
          "email_search",
          'Found 3 emails matching "meeting"'
        );
      }
    });
    await expect(page.getByText(/found.*email/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("executes email_send intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("email_send", {
          to: "test@example.com",
          subject: "Hello",
          body: "Test email",
        });
        b.simulateIntentResponse("email_send", "Email sent to test@example.com");
      }
    });
    await expect(page.getByText(/email sent/i)).toBeVisible({ timeout: 5_000 });
  });
});