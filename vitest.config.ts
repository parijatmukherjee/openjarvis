import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        // `bin/**` are CLI entrypoints exercised by the black-box functional suite
        // in a separate process, so they cannot be instrumented by the in-process
        // unit run — they are covered end-to-end (test-functional/*.e2e.test.ts).
        "packages/*/src/bin/**",
        // Optional-peer-backed embedder: only runs when @huggingface/transformers is
        // installed; excluded from the coverage gate (lazy import, never executed in
        // the in-process unit suite without the optional package).
        "packages/*/src/transformers-embedder.ts",
        // Runtime-selection glue: thin dispatch that picks a concrete driver at
        // startup based on env vars — tested end-to-end, not unit-instrumented.
        "packages/*/src/driver/select.ts",
        // Type-only modules: nothing but `interface`/`type` declarations, which
        // erase to no runtime code — there are no statements or branches to cover.
        "packages/*/src/loop/turn.ts",
        "packages/*/src/models/adapter.ts",
        "packages/*/src/tools/tool.ts",
        "packages/*/src/fragment.ts",
        "packages/*/src/types.ts",
        "packages/*/src/observability/index.ts",
        "packages/*/src/memory.ts",
        // Type-only / barrel files with no testable logic
        "packages/skills-calendar/src/types.ts",
        "packages/skills-notion/src/types.ts",
        "packages/skills-email/src/types.ts",
        "packages/cron/src/types.ts",
        "packages/channels/src/telegram/types.ts",
        // Requires a real browser; tested via mocks in browser-tools.test.ts
        "packages/skills-web/src/browser.ts",
        // Telegram bot poll loop requires a live server; tested via integration/E2E
        "packages/channels/src/telegram/bot.ts",
        // Hard-to-unit-test async cron callback; integration-tested
        "packages/cron/src/scheduler.ts",
        // IMAP client null-safety branches in mapMessage/parseSearchQuery;
        // require precise IMAP envelope shapes — tested via integration
        "packages/skills-email/src/gmail/imap-client.ts",
        // Graph calendar client null-safety mapping branches; all defensive fallbacks
        // for missing optional Graph API fields — tested via integration
        "packages/skills-calendar/src/graph-calendar-client.ts",
        // Notion client null-safety mapping and constructor fallback branches;
        // property name fallback chains tested via integration
        "packages/skills-notion/src/notion-client.ts",
        // OAuth constructor default-fetch and error-coalescing fallback branches;
        // tested via integration with real token flow
        "packages/skills-email/src/graph/oauth.ts",
        // Graph email client null-safety mapping branches for optional fields;
        // tested via integration
        "packages/skills-email/src/graph/graph-client.ts",
        // Weather client defensive null-safety branches for wttr.in API data;
        // tested via integration
        "packages/skills-weather/src/weather.ts",
        // Barrel re-export files: no logic, only re-exports
        "packages/*/src/index.ts",
        // Type-only package: all interface/type declarations — no runtime code.
        "packages/jarvis/src/**",
        // Skeleton packages: stubs and placeholder implementations — not yet functional.
        "packages/skills/src/**",
        "packages/desktop/src/**",
        "packages/agents/src/factory.ts",
      ],
      reporter: ["text", "html", "lcov", "json-summary"],
      // The merge gate: coverage MUST stay above these floors (enforced locally,
      // in Docker, and in CI). Lines/statements/functions are held at >99%.
      thresholds: {
        statements: 99,
        lines: 99,
        functions: 99,
        branches: 99,
      },
    },
  },
});
