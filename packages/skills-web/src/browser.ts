import type { LaunchOptions } from "playwright";

export interface AccessibilityNode {
  role: string;
  name?: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
}

export interface BrowserAutomation {
  navigate(url: string, tabId?: string): Promise<{ title: string; url: string }>;
  click(selector: string, tabId?: string): Promise<{ clicked: boolean }>;
  type(selector: string, text: string, tabId?: string): Promise<{ typed: boolean }>;
  screenshot(tabId?: string): Promise<{ data: string; mimeType: string }>;
  accessibility(tabId?: string): Promise<AccessibilityNode>;
  getCookies(): Promise<Array<{ name: string; value: string; domain: string; path: string }>>;
  setCookies(
    cookies: Array<{ name: string; value: string; domain: string; path?: string }>,
  ): Promise<void>;
  clearCookies(): Promise<void>;
  listTabs(): Promise<TabInfo[]>;
  switchTab(tabId: string): Promise<void>;
  closeTab(tabId: string): Promise<void>;
  close(): Promise<void>;
}

export class PlaywrightBrowserAutomation implements BrowserAutomation {
  private browser: import("playwright").Browser | undefined;
  private context: import("playwright").BrowserContext | undefined;
  private pages = new Map<string, import("playwright").Page>();
  private activeTabId: string | undefined;
  private readonly launchOptions: LaunchOptions | undefined;

  constructor(options?: { launchOptions?: LaunchOptions }) {
    this.launchOptions = options?.launchOptions;
  }

  private async ensureBrowser(tabId?: string): Promise<import("playwright").Page> {
    if (!this.browser) {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch(this.launchOptions);
    }
    if (!this.context) {
      this.context = await this.browser.newContext();
    }
    if (tabId !== undefined) {
      const page = this.pages.get(tabId);
      if (page) return page;
    }
    if (this.activeTabId !== undefined) {
      const page = this.pages.get(this.activeTabId);
      if (page) return page;
    }
    const page = await this.context.newPage();
    const id = crypto.randomUUID();
    this.pages.set(id, page);
    this.activeTabId = id;
    return page;
  }

  async navigate(url: string, tabId?: string): Promise<{ title: string; url: string }> {
    const page = await this.ensureBrowser(tabId);
    const response = await page.goto(url);
    if (!response) {
      throw new Error(`failed to navigate to ${url}`);
    }
    const title = await page.title();
    return { title, url: page.url() };
  }

  async click(selector: string, tabId?: string): Promise<{ clicked: boolean }> {
    const page = await this.ensureBrowser(tabId);
    await page.click(selector, { timeout: 5000 });
    return { clicked: true };
  }

  async type(selector: string, text: string, tabId?: string): Promise<{ typed: boolean }> {
    const page = await this.ensureBrowser(tabId);
    await page.fill(selector, text);
    return { typed: true };
  }

  async screenshot(tabId?: string): Promise<{ data: string; mimeType: string }> {
    const page = await this.ensureBrowser(tabId);
    const buffer = await page.screenshot({ type: "png" });
    return { data: buffer.toString("base64"), mimeType: "image/png" };
  }

  async accessibility(tabId?: string): Promise<AccessibilityNode> {
    const page = await this.ensureBrowser(tabId);
    const snapshot = await page.ariaSnapshot();
    return { role: "page", value: snapshot };
  }

  async getCookies(): Promise<
    Array<{ name: string; value: string; domain: string; path: string }>
  > {
    if (!this.context) {
      return [];
    }
    const cookies = await this.context.cookies();
    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));
  }

  async setCookies(
    cookies: Array<{ name: string; value: string; domain: string; path?: string }>,
  ): Promise<void> {
    if (!this.context) {
      throw new Error("browser context not initialized");
    }
    await this.context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path ?? "/",
      })),
    );
  }

  async clearCookies(): Promise<void> {
    if (!this.context) {
      return;
    }
    await this.context.clearCookies();
  }

  async listTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    for (const [id, page] of this.pages) {
      tabs.push({ id, url: page.url(), title: await page.title() });
    }
    return tabs;
  }

  async switchTab(tabId: string): Promise<void> {
    const page = this.pages.get(tabId);
    if (!page) {
      throw new Error(`tab not found: ${tabId}`);
    }
    this.activeTabId = tabId;
    await page.bringToFront();
  }

  async closeTab(tabId: string): Promise<void> {
    const page = this.pages.get(tabId);
    if (!page) {
      throw new Error(`tab not found: ${tabId}`);
    }
    await page.close();
    this.pages.delete(tabId);
    if (this.activeTabId === tabId) {
      const remaining = [...this.pages.keys()];
      this.activeTabId = remaining[0];
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = undefined;
    this.context = undefined;
    this.pages.clear();
    this.activeTabId = undefined;
  }
}
