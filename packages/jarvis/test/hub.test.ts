import { describe, it, expect } from "vitest";
import {
  JarvisHub,
  MockWakeWordEngine,
  MockSttEngine,
  MockTtsEngine,
  MockDisplayManager,
  MockDelegator,
  RuleBasedIntentParser,
  SimpleSynthesizer,
  SimpleScheduler,
  SimpleEventBus,
  type Delegator,
} from "../src/index.js";

function defaultPersona() {
  return {
    name: "Jarvis",
    voice: { engine: "mock", speed: 1, pitch: 1 },
    greeting: "Hello.",
    farewell: "Goodbye.",
    tone: "professional" as const,
    injectIntoSystemPrompt: (base: string) => base,
  };
}

function buildHub(opts: {
  sttResponses?: string[];
  displayManager?: MockDisplayManager;
  ttsEngine?: MockTtsEngine;
  delegator?: MockDelegator;
}) {
  const wakeWord = new MockWakeWordEngine();
  const stt = new MockSttEngine(opts.sttResponses ?? []);
  const tts = opts.ttsEngine ?? new MockTtsEngine();
  const display = opts.displayManager ?? new MockDisplayManager();
  const eventBus = new SimpleEventBus();
  const scheduler = new SimpleScheduler();

  const hub = new JarvisHub({
    persona: defaultPersona(),
    intentParser: new RuleBasedIntentParser(),
    delegator: opts.delegator ?? new MockDelegator(),
    synthesizer: new SimpleSynthesizer(),
    displayManager: display,
    ttsEngine: tts,
    wakeWordEngine: wakeWord,
    scheduler,
    eventBus,
    readInputOverride: async () => stt.transcribe(),
  });

  return { hub, wakeWord, tts, display, eventBus, stt };
}

describe("JarvisHub", () => {
  it("starts in idle state", async () => {
    const { hub } = buildHub({});
    await hub.start();
    expect(hub.currentState).toBe("idle");
    await hub.stop();
  });

  it("transitions through the full lifecycle on wake + empty input", async () => {
    const { hub, eventBus } = buildHub({ sttResponses: [""] });
    const states: string[] = [];
    eventBus.subscribe("jarvis.state_changed", (ev) => {
      states.push((ev.payload as { to: string }).to);
    });

    await hub.start();
    await hub.simulateWake();

    expect(states).toEqual(["idle", "listening", "thinking", "idle"]);
    expect(hub.currentState).toBe("idle");
    await hub.stop();
  });

  it("parses 'open calendar' and delegates to system agent", async () => {
    const { hub, display, tts } = buildHub({ sttResponses: ["open calendar"] });

    await hub.start();
    await hub.simulateWake();

    const commands = display.getCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ type: "open_app", app: "calendar" });

    const spoken = tts.getSpoken();
    expect(spoken.length).toBeGreaterThanOrEqual(1);
    expect(spoken[0]).toMatch(/Done/);

    await hub.stop();
  });

  it("parses 'search for mechanical keyboards' and opens browser", async () => {
    const { hub, display } = buildHub({ sttResponses: ["search for mechanical keyboards"] });

    await hub.start();
    await hub.simulateWake();

    const commands = display.getCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ type: "open_url" });
    expect((commands[0] as { url?: string }).url).toContain("google.com");
    expect((commands[0] as { url?: string }).url).toContain("mechanical%20keyboards");

    await hub.stop();
  });

  it("parses 'what do you see' and delegates to vision agent", async () => {
    const { hub, display } = buildHub({ sttResponses: ["what do you see"] });

    await hub.start();
    await hub.simulateWake();

    const commands = display.getCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ type: "open_vision_feed" });

    await hub.stop();
  });

  it("asks for clarification on ambiguous input", async () => {
    const { hub, tts } = buildHub({ sttResponses: ["blah blah"] });

    await hub.start();
    await hub.simulateWake();

    const spoken = tts.getSpoken();
    expect(spoken[spoken.length - 1]).toMatch(/not sure/);
    expect(hub.currentState).toBe("idle");

    await hub.stop();
  });

  it("ignores wake word when already processing", async () => {
    const { hub } = buildHub({ sttResponses: ["open calendar"] });

    await hub.start();
    // First wake triggers the full cycle
    const p1 = hub.simulateWake();
    // Second wake should be ignored because state !== idle
    const p2 = hub.simulateWake();

    await p1;
    // p2 resolves immediately because onWakeWord returns early
    await p2;

    expect(hub.currentState).toBe("idle");
    await hub.stop();
  });

  it("emits state change events with session id", async () => {
    const { hub, eventBus } = buildHub({ sttResponses: ["open calendar"] });
    const events: { from: string; to: string; sessionId?: string }[] = [];

    eventBus.subscribe("jarvis.state_changed", (ev) => {
      events.push(ev.payload as { from: string; to: string; sessionId?: string });
    });

    await hub.start();
    await hub.simulateWake();

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]!.sessionId).toBeDefined();
    // All events share the same session id
    const sessionId = events[0]!.sessionId;
    expect(events.every((e) => e.sessionId === sessionId)).toBe(true);

    await hub.stop();
  });

  it("handles delegator errors gracefully", async () => {
    const throwingDelegator = {
      delegate: async () => {
        throw new Error("delegator failure");
      },
    };

    const { hub } = buildHub({
      sttResponses: ["open calendar"],
      delegator: throwingDelegator as Delegator,
    });

    await hub.start();
    await expect(hub.simulateWake()).rejects.toThrow("delegator failure");
    expect(hub.currentState).toBe("idle");

    await hub.stop();
  });
});
