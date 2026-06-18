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
  private initPromise: Promise<import("playwright").Browser> | undefined;

  constructor(options?: { launchOptions?: LaunchOptions }) {
    this.launchOptions = options?.launchOptions;
  }

  private async ensureBrowser(tabId?: string): Promise<import("playwright").Page> {
    if (!this.browser && !this.initPromise) {
      const { chromium } = await import("playwright");
      this.initPromise = chromium.launch(this.launchOptions);
    }
    try {
      this.browser = await this.initPromise;
    } catch {
      this.initPromise = undefined;
      throw new Error("Failed to launch browser");
    }
    this.initPromise = undefined;
    if (!this.context) {
      this.context = await this.browser!.newContext();
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
    const resolvedTabId = tabId ?? this.activeTabId;
    const page = await this.ensureBrowser(tabId);
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });
      if (!response) {
        if (resolvedTabId === undefined) {
          this.pages.delete(this.activeTabId!);
          await page.close().catch(() => {});
          this.activeTabId = undefined;
        }
        throw new Error(`failed to navigate to ${url}`);
      }
    } catch (err) {
      const currentTabId = resolvedTabId ?? this.activeTabId;
      if (currentTabId !== undefined && this.pages.get(currentTabId) === page) {
        this.pages.delete(currentTabId);
        await page.close().catch(() => {});
        if (this.activeTabId === currentTabId) {
          this.activeTabId = undefined;
        }
      }
      throw err;
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
    return this.parseAriaSnapshot(snapshot);
  }

  private parseAriaSnapshot(snapshot: string): AccessibilityNode {
    const lines = snapshot.split("\n");
    const root: AccessibilityNode = { role: "page", children: [] };
    const stack: { node: AccessibilityNode; indent: number }[] = [{ node: root, indent: -1 }];

    for (const line of lines) {
      const indent = line.search(/\S/);
      if (indent === -1) continue;
      const text = line.trimStart();
      const match = text.match(/^(\S+)\s+"(.*)"/u);
      if (!match) continue;
      const node: AccessibilityNode = { role: match[1], name: match[2] };
      while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]!;
      if (!parent.node.children) parent.node.children = [];
      parent.node.children.push(node);
      stack.push({ node, indent });
    }

    return root;
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
      if (this.activeTabId && this.pages.has(this.activeTabId)) {
        await this.pages.get(this.activeTabId)!.bringToFront();
      }
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
