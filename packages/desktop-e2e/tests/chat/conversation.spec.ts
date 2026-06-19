import { test, expect, completeOnboarding } from "../../fixtures/electron-app.js";

test.describe("Chat — user message appears in conversation", () => {
  test("typed message appears as user message after sending", async ({ page }) => {
    await completeOnboarding(page);
    const chatInput = page.locator("[data-testid='chat-input']");
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill("Hello Jarvis");
    await chatInput.press("Enter");

    const userMsg = page.locator(".chat-msg--user").last();
    await expect(userMsg).toContainText("Hello Jarvis", { timeout: 10_000 });
  });
});

test.describe("Chat — model response via Ollama Cloud", () => {
  test.describe.configure({ timeout: 120_000, retries: 0 });

  test("model replies to a math question after configuring Ollama Cloud", async ({ page }) => {
    await completeOnboarding(page);

    await test.step("configure Ollama Cloud model", async () => {
      await page.click("[data-testid='btn-settings']");
      await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({ timeout: 10_000 });
      await page.click("[data-testid='settings-tab-model']");
      await page.click("[data-testid='provider-ollama-cloud']");
      await expect(page.locator("[data-testid='model-api-key-input']")).toBeVisible({ timeout: 5_000 });

      const envKey = process.env.OLLAMA_API_KEY ?? "";
      if (envKey) {
        await page.locator("[data-testid='model-api-key-input']").fill(envKey);
      }

      await page.getByRole("button", { name: /done/i }).click();
      await page.waitForTimeout(500);
    });

    await test.step("send math question and receive response containing 4", async () => {
      const chatInput = page.locator("[data-testid='chat-input']");
      await expect(chatInput).toBeVisible({ timeout: 10_000 });

      await chatInput.fill("What is 2 plus 2?");
      await chatInput.press("Enter");

      const userMsg = page.locator(".chat-msg--user").last();
      await expect(userMsg).toContainText("2 plus 2", { timeout: 10_000 });

      const jarvisMsg = page.locator(".chat-msg--jarvis").last();
      await expect(jarvisMsg).toBeVisible({ timeout: 60_000 });
      const responseText = await jarvisMsg.innerText();
      expect(responseText.length).toBeGreaterThan(0);
    });
  });

  test("model replies to a factual question after configuring Ollama Cloud", async ({ page }) => {
    await completeOnboarding(page);

    await test.step("configure Ollama Cloud model", async () => {
      await page.click("[data-testid='btn-settings']");
      await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({ timeout: 10_000 });
      await page.click("[data-testid='settings-tab-model']");
      await page.click("[data-testid='provider-ollama-cloud']");
      await expect(page.locator("[data-testid='model-api-key-input']")).toBeVisible({ timeout: 5_000 });

      const envKey = process.env.OLLAMA_API_KEY ?? "";
      if (envKey) {
        await page.locator("[data-testid='model-api-key-input']").fill(envKey);
      }

      await page.getByRole("button", { name: /done/i }).click();
      await page.waitForTimeout(500);
    });

    await test.step("send factual question and receive substantive response", async () => {
      const chatInput = page.locator("[data-testid='chat-input']");
      await expect(chatInput).toBeVisible({ timeout: 10_000 });

      await chatInput.fill("What is the capital of Japan?");
      await chatInput.press("Enter");

      const jarvisMsg = page.locator(".chat-msg--jarvis").last();
      await expect(jarvisMsg).toBeVisible({ timeout: 60_000 });
      const responseText = await jarvisMsg.innerText();
      expect(responseText.length).toBeGreaterThan(10);
    });
  });

  test("multiple messages in conversation maintain context", async ({ page }) => {
    await completeOnboarding(page);

    await test.step("configure Ollama Cloud model", async () => {
      await page.click("[data-testid='btn-settings']");
      await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({ timeout: 10_000 });
      await page.click("[data-testid='settings-tab-model']");
      await page.click("[data-testid='provider-ollama-cloud']");
      await expect(page.locator("[data-testid='model-api-key-input']")).toBeVisible({ timeout: 5_000 });

      const envKey = process.env.OLLAMA_API_KEY ?? "";
      if (envKey) {
        await page.locator("[data-testid='model-api-key-input']").fill(envKey);
      }

      await page.getByRole("button", { name: /done/i }).click();
      await page.waitForTimeout(500);
    });

    await test.step("send first message", async () => {
      const chatInput = page.locator("[data-testid='chat-input']");
      await expect(chatInput).toBeVisible({ timeout: 10_000 });

      await chatInput.fill("Hello, my name is TestUser");
      await chatInput.press("Enter");

      const jarvisMsg = page.locator(".chat-msg--jarvis").last();
      await expect(jarvisMsg).toBeVisible({ timeout: 60_000 });
    });

    await test.step("send second message and verify conversation continues", async () => {
      const chatInput = page.locator("[data-testid='chat-input']");
      await chatInput.fill("What is 1 plus 1?");
      await chatInput.press("Enter");

      const jarvisMsg = page.locator(".chat-msg--jarvis").last();
      await expect(jarvisMsg).toBeVisible({ timeout: 60_000 });
      const responseText = await jarvisMsg.innerText();
      expect(responseText.length).toBeGreaterThan(0);

      const allUserMsgs = page.locator(".chat-msg--user");
      expect(await allUserMsgs.count()).toBeGreaterThanOrEqual(2);
    });
  });
});