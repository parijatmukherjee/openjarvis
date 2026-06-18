import { describe, it, expect } from "vitest";
import { mapMessageCreate } from "../../../src/discord/handlers/message-create.js";

describe("mapMessageCreate", () => {
  it("maps a valid MESSAGE_CREATE payload to DiscordMessage", () => {
    const payload = {
      id: "msg1",
      channel_id: "chan1",
      guild_id: "guild1",
      author: { id: "u1", username: "alice", bot: false },
      content: "hello world",
      timestamp: "2024-01-01T00:00:00.000Z",
      edited_timestamp: null,
      attachments: [],
    };

    const result = mapMessageCreate(payload);
    expect(result).toEqual({
      id: "msg1",
      channelId: "chan1",
      guildId: "guild1",
      authorId: "u1",
      authorUsername: "alice",
      content: "hello world",
      timestamp: new Date("2024-01-01T00:00:00.000Z").getTime(),
      editedTimestamp: null,
      attachments: [],
    });
  });

  it("maps attachments correctly", () => {
    const payload = {
      id: "msg2",
      channel_id: "chan2",
      author: { id: "u2", username: "bob" },
      content: "see attached",
      timestamp: "2024-06-01T12:00:00.000Z",
      edited_timestamp: "2024-06-01T12:05:00.000Z",
      attachments: [
        {
          id: "att1",
          url: "https://example.com/file.png",
          filename: "file.png",
          content_type: "image/png",
          size: 1234,
        },
      ],
    };

    const result = mapMessageCreate(payload);
    expect(result.attachments).toEqual([
      {
        id: "att1",
        url: "https://example.com/file.png",
        filename: "file.png",
        contentType: "image/png",
        size: 1234,
      },
    ]);
    expect(result.editedTimestamp).toBe(new Date("2024-06-01T12:05:00.000Z").getTime());
  });

  it("defaults guild_id to null", () => {
    const payload = {
      id: "msg3",
      channel_id: "chan3",
      author: { id: "u3", username: "carol" },
      content: "dm message",
      timestamp: "2024-01-01T00:00:00.000Z",
      attachments: [],
    };

    const result = mapMessageCreate(payload);
    expect(result.guildId).toBeNull();
  });

  it("throws on invalid payload without id", () => {
    expect(() => mapMessageCreate({})).toThrow("Missing id");
  });

  it("throws on invalid payload without channel_id", () => {
    expect(() => mapMessageCreate({ id: "1" })).toThrow("Missing channel_id");
  });

  it("throws on invalid payload without author", () => {
    expect(() => mapMessageCreate({ id: "1", channel_id: "c1" })).toThrow("Missing author");
  });

  it("throws on non-object payload", () => {
    expect(() => mapMessageCreate("not an object")).toThrow("Invalid MESSAGE_CREATE payload");
    expect(() => mapMessageCreate(null)).toThrow("Invalid MESSAGE_CREATE payload");
    expect(() => mapMessageCreate(42)).toThrow("Invalid MESSAGE_CREATE payload");
  });
});
