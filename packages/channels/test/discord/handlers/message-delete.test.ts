import { describe, it, expect } from "vitest";
import { mapMessageDelete } from "../../../src/discord/handlers/message-delete.js";

describe("mapMessageDelete", () => {
  it("maps a valid MESSAGE_DELETE payload", () => {
    const payload = {
      id: "msg1",
      channel_id: "chan1",
    };

    const result = mapMessageDelete(payload);
    expect(result).toEqual({ id: "msg1", channelId: "chan1" });
  });

  it("throws on missing id", () => {
    expect(() => mapMessageDelete({ channel_id: "c1" })).toThrow("Missing id");
  });

  it("throws on missing channel_id", () => {
    expect(() => mapMessageDelete({ id: "m1" })).toThrow("Missing channel_id");
  });

  it("throws on non-object payload", () => {
    expect(() => mapMessageDelete("bad")).toThrow("Invalid MESSAGE_DELETE payload");
    expect(() => mapMessageDelete(null)).toThrow("Invalid MESSAGE_DELETE payload");
  });
});
