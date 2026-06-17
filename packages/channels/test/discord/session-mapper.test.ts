import { describe, it, expect } from "vitest";
import { DiscordSessionMapper } from "../../src/discord/session-mapper.js";

describe("DiscordSessionMapper", () => {
  const mapper = new DiscordSessionMapper("guild123");

  it("channelToSession maps to discord:{guildId}:{channelId}", () => {
    expect(mapper.channelToSession("chan456")).toBe("discord:guild123:chan456");
  });

  it("dmToSession maps to discord:dm:{userId}", () => {
    expect(mapper.dmToSession("user789")).toBe("discord:dm:user789");
  });

  it("sessionToChannel extracts channel ID", () => {
    expect(mapper.sessionToChannel("discord:guild123:chan456")).toBe("chan456");
  });

  it("sessionToDmUser extracts user ID", () => {
    expect(mapper.sessionToDmUser("discord:dm:user789")).toBe("user789");
  });

  it("sessionToChannel returns null for non-discord session IDs", () => {
    expect(mapper.sessionToChannel("slack:abc")).toBeNull();
  });

  it("sessionToChannel returns null for DM session IDs", () => {
    expect(mapper.sessionToChannel("discord:dm:user789")).toBeNull();
  });

  it("sessionToDmUser returns null for non-DM session IDs", () => {
    expect(mapper.sessionToDmUser("discord:guild123:chan456")).toBeNull();
  });

  it("sessionToDmUser returns null for non-discord session IDs", () => {
    expect(mapper.sessionToDmUser("slack:abc")).toBeNull();
  });

  it("isDiscordSession identifies discord sessions correctly", () => {
    expect(mapper.isDiscordSession("discord:guild123:chan456")).toBe(true);
    expect(mapper.isDiscordSession("discord:dm:user789")).toBe(true);
    expect(mapper.isDiscordSession("slack:abc")).toBe(false);
  });

  it("sessionToChannel returns null for too-short session IDs", () => {
    expect(mapper.sessionToChannel("discord:")).toBeNull();
  });
});