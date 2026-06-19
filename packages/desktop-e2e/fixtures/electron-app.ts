import { test as base, type Page, type ElectronApplication } from "@playwright/test";
import { _electron as electron } from "playwright";
import { PlaywrightTestBridge } from "./test-bridge.js";

export type ElectronFixture = {
  electronApp: ElectronApplication;
  page: Page;
  bridge: PlaywrightTestBridge;
};

export const test = base.extend<ElectronFixture>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      env: {
        ...process.env,
        OPENJARVIS_DEV: "1",
        NODE_ENV: "test",
      },
    });
    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },

  bridge: async ({ page }, use) => {
    const bridge = new PlaywrightTestBridge();
    await page.evaluate(
      (bridgeData) => {
        const { tasks, agents, messages } = bridgeData;
        const handlers = new Set<(event: unknown) => void>();

        const win = window as unknown as { __testBridge?: unknown };
        win.__testBridge = {
          async getTasks() {
            return tasks;
          },
          async getAgents() {
            return agents;
          },
          async getMessages() {
            return messages;
          },
          async executeIntent(_action: string, _params: Record<string, unknown>) {
            return;
          },
          subscribeToEvents(handler: (event: unknown) => void) {
            handlers.add(handler);
            return () => {
              handlers.delete(handler);
            };
          },
        };
      },
      {
        tasks: await bridge.getTasks(),
        agents: await bridge.getAgents(),
        messages: await bridge.getMessages(),
      },
    );
    await use(bridge);
  },
});

export const expect = test.expect;
