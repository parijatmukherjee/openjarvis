import { describe, it, expect } from "vitest";
import { TelegramSessionMapper } from "../../src/telegram/session-mapper.js";

describe("TelegramSessionMapper", () => {
  const mapper = new TelegramSessionMapper();

  it("maps DM to telegram:dm:{chatId}", () => {
    expect(mapper.getOrCreateSession(12345, "private")).toBe("telegram:dm:12345");
  });

  it("maps group to telegram:group:{chatId}", () => {
    expect(mapper.getOrCreateSession(67890, "group")).toBe("telegram:group:67890");
  });

  it("maps supergroup to telegram:group:{chatId}", () => {
    expect(mapper.getOrCreateSession(11111, "supergroup")).toBe("telegram:group:11111");
  });

  it("returns same session for same chatId", () => {
    const first = mapper.getOrCreateSession(99999, "private");
    const second = mapper.getOrCreateSession(99999, "group");
    expect(first).toBe(second);
  });

  it("getSession returns existing session", () => {
    mapper.getOrCreateSession(55555, "private");
    expect(mapper.getSession(55555)).toBe("telegram:dm:55555");
  });

  it("getSession returns undefined for unknown chatId", () => {
    expect(mapper.getSession(0)).toBeUndefined();
  });

  it("removeSession removes a session", () => {
    mapper.getOrCreateSession(77777, "group");
    expect(mapper.getSession(77777)).toBe("telegram:group:77777");
    mapper.removeSession(77777);
    expect(mapper.getSession(77777)).toBeUndefined();
  });
});
