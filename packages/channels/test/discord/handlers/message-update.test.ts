import { describe, it, expect } from "vitest";
import { mapMessageUpdate } from "../../../src/discord/handlers/message-update.js";

describe("mapMessageUpdate", () => {
  it("maps a valid MESSAGE_UPDATE payload to DiscordMessage", () => {
    const payload = {
      id: "msg1",
      channel_id: "chan1",
      guild_id: "guild1",
      author: { id: "u1", username: "alice" },
      content: "updated message",
      timestamp: "2024-01-01T00:00:00.000Z",
      edited_timestamp: "2024-01-02T00:00:00.000Z",
      attachments: [],
    };

    const result = mapMessageUpdate(payload);
    expect(result).toEqual({
      id: "msg1",
      channelId: "chan1",
      guildId: "guild1",
      authorId: "u1",
      authorUsername: "alice",
      content: "updated message",
      timestamp: new Date("2024-01-01T00:00:00.000Z").getTime(),
      editedTimestamp: new Date("2024-01-02T00:00:00.000Z").getTime(),
      attachments: [],
    });
  });

  it("fills defaults for missing optional fields", () => {
    const payload = {
      id: "msg2",
    };

    const result = mapMessageUpdate(payload);
    expect(result.id).toBe("msg2");
    expect(result.channelId).toBe("");
    expect(result.authorId).toBe("");
    expect(result.authorUsername).toBe("");
    expect(result.content).toBe("");
    expect(result.timestamp).toBe(0);
    expect(result.editedTimestamp).toBeNull();
    expect(result.attachments).toEqual([]);
  });

  it("defaults guild_id to null when not present", () => {
    const payload = {
      id: "msg3",
      channel_id: "chan3",
      author: { id: "u3", username: "bob" },
      content: "hi",
      timestamp: "2024-06-01T00:00:00.000Z",
      attachments: [],
    };

    const result = mapMessageUpdate(payload);
    expect(result.guildId).toBeNull();
  });

  it("throws on invalid payload without id", () => {
    expect(() => mapMessageUpdate({})).toThrow("Missing id");
  });

  it("throws on non-object payload", () => {
    expect(() => mapMessageUpdate("bad")).toThrow("Invalid MESSAGE_UPDATE payload");
  });
});
