import { describe, it, expect } from "vitest";
import { mapReactionAdd } from "../../../src/discord/handlers/reaction-add.js";

describe("mapReactionAdd", () => {
  it("maps a valid REACTION_ADD payload with emoji name", () => {
    const payload = {
      user_id: "u1",
      channel_id: "chan1",
      message_id: "msg1",
      emoji: { name: "👍" },
    };

    const result = mapReactionAdd(payload);
    expect(result).toEqual({
      messageId: "msg1",
      channelId: "chan1",
      emoji: "👍",
      userId: "u1",
    });
  });

  it("uses emoji id when name is missing", () => {
    const payload = {
      user_id: "u2",
      channel_id: "chan2",
      message_id: "msg2",
      emoji: { id: "emoji123" },
    };

    const result = mapReactionAdd(payload);
    expect(result.emoji).toBe("emoji123");
  });

  it("uses empty string when emoji has no name or id", () => {
    const payload = {
      user_id: "u3",
      channel_id: "chan3",
      message_id: "msg3",
      emoji: {},
    };

    const result = mapReactionAdd(payload);
    expect(result.emoji).toBe("");
  });

  it("throws on missing user_id", () => {
    expect(() =>
      mapReactionAdd({ channel_id: "c1", message_id: "m1", emoji: { name: "a" } }),
    ).toThrow("Missing user_id");
  });

  it("throws on missing channel_id", () => {
    expect(() => mapReactionAdd({ user_id: "u1", message_id: "m1", emoji: { name: "a" } })).toThrow(
      "Missing channel_id",
    );
  });

  it("throws on missing message_id", () => {
    expect(() => mapReactionAdd({ user_id: "u1", channel_id: "c1", emoji: { name: "a" } })).toThrow(
      "Missing message_id",
    );
  });

  it("throws on missing emoji", () => {
    expect(() => mapReactionAdd({ user_id: "u1", channel_id: "c1", message_id: "m1" })).toThrow(
      "Missing emoji",
    );
  });

  it("throws on non-object payload", () => {
    expect(() => mapReactionAdd("bad")).toThrow("Invalid REACTION_ADD payload");
  });
});
