import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "@openjarvis/core";
import type { AgentGrant } from "@openjarvis/core";
import { GraphCalendarClient } from "../src/graph-calendar-client.js";
import {
  createCalendarListTool,
  createCalendarGetEventsTool,
  createCalendarCreateTool,
  createCalendarUpdateTool,
  createCalendarDeleteTool,
  registerCalendarTools,
} from "../src/tools.js";

const mockGetToken = vi.fn<() => Promise<string>>().mockResolvedValue("tok-123");
const mockFetch = vi.fn();

function createClient(): GraphCalendarClient {
  return new GraphCalendarClient({ getToken: mockGetToken, fetch: mockFetch });
}

const ctx = { agentId: "test-agent" };

const graphCalendar = {
  id: "cal-1",
  name: "Calendar",
  color: "auto",
  isDefaultCalendar: true,
};

const graphEvent = {
  id: "evt-1",
  subject: "Team Meeting",
  body: { content: "Discuss Q3", contentType: "text" },
  start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
  end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
  location: { displayName: "Room 42" },
  attendees: [
    { emailAddress: { name: "Alice", address: "alice@example.com" }, type: "required" },
  ],
  isAllDay: false,
};

describe("GraphCalendarClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("tok-123");
  });

  describe("listCalendars", () => {
    it("calls Graph API and maps to CalendarInfo[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [graphCalendar] }),
      });

      const client = createClient();
      const calendars = await client.listCalendars();

      expect(calendars).toEqual([
        { id: "cal-1", name: "Calendar", isDefault: true, color: "auto" },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/calendars",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer tok-123" }),
        }),
      );
    });
  });

  describe("getEvents", () => {
    it("calls Graph API and maps to CalendarEvent[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [graphEvent] }),
      });

      const client = createClient();
      const events = await client.getEvents("cal-1");

      expect(events).toEqual([
        {
          id: "evt-1",
          subject: "Team Meeting",
          body: "Discuss Q3",
          start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
          end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
          location: "Room 42",
          attendees: [{ name: "Alice", address: "alice@example.com", type: "required" }],
          isAllDay: false,
        },
      ]);
    });

    it("passes query parameters for start, end, and limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const client = createClient();
      await client.getEvents("cal-1", { start: "2026-06-18T00:00:00", end: "2026-06-19T00:00:00", limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("startDateTime=2026-06-18T00%3A00%3A00"),
        expect.anything(),
      );
    });
  });

  describe("createEvent", () => {
    it("sends POST to /me/calendars/{id}/events", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "evt-new" }),
      });

      const client = createClient();
      const eventId = await client.createEvent("cal-1", {
        subject: "New Meeting",
        start: { dateTime: "2026-06-18T14:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T15:00:00", timeZone: "UTC" },
      });

      expect(eventId).toBe("evt-new");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/calendars/cal-1/events",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("updateEvent", () => {
    it("sends PATCH to /me/events/{id}", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "evt-1" }),
      });

      const client = createClient();
      const eventId = await client.updateEvent("evt-1", { subject: "Updated Meeting" });

      expect(eventId).toBe("evt-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/events/evt-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("deleteEvent", () => {
    it("sends DELETE to /me/events/{id}", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      });

      const client = createClient();
      const deleted = await client.deleteEvent("evt-1");

      expect(deleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/events/evt-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("error handling", () => {
    it("handles 429 rate limiting with Retry-After header", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => "1" },
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [] }),
        });

      const client = createClient();
      const promise = client.listCalendars();

      await vi.advanceTimersByTimeAsync(1500);
      const calendars = await promise;

      expect(calendars).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("handles 404 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: { message: "The event was not found" } }),
      });

      const client = createClient();
      await expect(client.deleteEvent("missing")).rejects.toThrow("Graph API 404");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = createClient();
      await expect(client.listCalendars()).rejects.toThrow("Network error");
    });

    it("handles generic API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ error: { message: "Insufficient privileges" } }),
      });

      const client = createClient();
      await expect(client.listCalendars()).rejects.toThrow("Graph API 403");
    });
  });
});

describe("calendar_list tool", () => {
  it("registers with calendar:read capability", () => {
    const client = createClient();
    const tool = createCalendarListTool(client);
    expect(tool.name).toBe("calendar_list");
    expect(tool.capabilities).toEqual([{ name: "calendar:read" }]);
  });

  it("calls client.listCalendars and returns calendars", async () => {
    const client = createClient();
    vi.spyOn(client, "listCalendars").mockResolvedValueOnce([
      { id: "cal-1", name: "Calendar", isDefault: true },
    ]);

    const tool = createCalendarListTool(client);
    const result = await tool.handler({ provider: "graph" }, ctx);
    expect(result).toEqual({ calendars: [{ id: "cal-1", name: "Calendar", isDefault: true }] });
  });
});

describe("calendar_get_events tool", () => {
  it("registers with calendar:read capability", () => {
    const client = createClient();
    const tool = createCalendarGetEventsTool(client);
    expect(tool.name).toBe("calendar_get_events");
    expect(tool.capabilities).toEqual([{ name: "calendar:read" }]);
  });

  it("calls client.getEvents with calendarId and options", async () => {
    const client = createClient();
    vi.spyOn(client, "getEvents").mockResolvedValueOnce([
      {
        id: "evt-1",
        subject: "Meeting",
        start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
        attendees: [],
        isAllDay: false,
      },
    ]);

    const tool = createCalendarGetEventsTool(client);
    const result = await tool.handler(
      { provider: "graph", calendarId: "cal-1", start: "2026-06-18T00:00:00", end: "2026-06-19T00:00:00", limit: 10 },
      ctx,
    );
    expect(result.events).toHaveLength(1);
    expect(client.getEvents).toHaveBeenCalledWith("cal-1", {
      start: "2026-06-18T00:00:00",
      end: "2026-06-19T00:00:00",
      limit: 10,
    });
  });
});

describe("calendar_create tool", () => {
  it("registers with calendar:write capability", () => {
    const client = createClient();
    const tool = createCalendarCreateTool(client);
    expect(tool.name).toBe("calendar_create");
    expect(tool.capabilities).toEqual([{ name: "calendar:write" }]);
  });

  it("calls client.createEvent", async () => {
    const client = createClient();
    vi.spyOn(client, "createEvent").mockResolvedValueOnce("evt-new");

    const tool = createCalendarCreateTool(client);
    const result = await tool.handler(
      {
        provider: "graph",
        calendarId: "cal-1",
        subject: "New Event",
        start: { dateTime: "2026-06-18T14:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T15:00:00", timeZone: "UTC" },
      },
      ctx,
    );
    expect(result).toEqual({ eventId: "evt-new" });
  });
});

describe("calendar_update tool", () => {
  it("registers with calendar:write capability", () => {
    const client = createClient();
    const tool = createCalendarUpdateTool(client);
    expect(tool.name).toBe("calendar_update");
    expect(tool.capabilities).toEqual([{ name: "calendar:write" }]);
  });

  it("calls client.updateEvent", async () => {
    const client = createClient();
    vi.spyOn(client, "updateEvent").mockResolvedValueOnce("evt-1");

    const tool = createCalendarUpdateTool(client);
    const result = await tool.handler(
      { provider: "graph", eventId: "evt-1", subject: "Updated" },
      ctx,
    );
    expect(result).toEqual({ eventId: "evt-1" });
  });
});

describe("calendar_delete tool", () => {
  it("registers with calendar:write capability", () => {
    const client = createClient();
    const tool = createCalendarDeleteTool(client);
    expect(tool.name).toBe("calendar_delete");
    expect(tool.capabilities).toEqual([{ name: "calendar:write" }]);
  });

  it("calls client.deleteEvent", async () => {
    const client = createClient();
    vi.spyOn(client, "deleteEvent").mockResolvedValueOnce(true);

    const tool = createCalendarDeleteTool(client);
    const result = await tool.handler({ provider: "graph", eventId: "evt-1" }, ctx);
    expect(result).toEqual({ deleted: true });
  });
});

describe("registerCalendarTools", () => {
  it("registers all five calendar tools", () => {
    const client = createClient();
    const registry = new ToolRegistry();
    registerCalendarTools(registry, client);
    const names = registry.list().map((t) => t.name);
    expect(names).toContain("calendar_list");
    expect(names).toContain("calendar_get_events");
    expect(names).toContain("calendar_create");
    expect(names).toContain("calendar_update");
    expect(names).toContain("calendar_delete");
  });

  it("denies calendar_delete without calendar:write capability", async () => {
    const client = createClient();
    vi.spyOn(client, "deleteEvent").mockResolvedValueOnce(true);

    const registry = new ToolRegistry();
    registerCalendarTools(registry, client);

    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await registry.invoke(
      { id: "c1", tool: "calendar_delete", args: { provider: "graph", eventId: "evt-1" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("denies calendar_list without calendar:read capability", async () => {
    const client = createClient();
    vi.spyOn(client, "listCalendars").mockResolvedValueOnce([]);

    const registry = new ToolRegistry();
    registerCalendarTools(registry, client);

    const noGrant: AgentGrant = { agentId: "test-agent", capabilities: [] };
    const result = await registry.invoke(
      { id: "c2", tool: "calendar_list", args: { provider: "graph" } },
      noGrant,
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/capability denied/);
  });

  it("allows calendar_list with calendar:read capability", async () => {
    const client = createClient();
    vi.spyOn(client, "listCalendars").mockResolvedValueOnce([]);

    const registry = new ToolRegistry();
    registerCalendarTools(registry, client);

    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "calendar:read" }] };
    const result = await registry.invoke(
      { id: "c3", tool: "calendar_list", args: { provider: "graph" } },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("allows calendar_create with calendar:write capability", async () => {
    const client = createClient();
    vi.spyOn(client, "createEvent").mockResolvedValueOnce("evt-new");

    const registry = new ToolRegistry();
    registerCalendarTools(registry, client);

    const grant: AgentGrant = { agentId: "test-agent", capabilities: [{ name: "calendar:write" }] };
    const result = await registry.invoke(
      {
        id: "c4",
        tool: "calendar_create",
        args: {
          provider: "graph",
          calendarId: "cal-1",
          subject: "Test",
          start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
          end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
        },
      },
      grant,
      ctx,
    );
    expect(result.ok).toBe(true);
  });
});