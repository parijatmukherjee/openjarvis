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
  attendees: [{ emailAddress: { name: "Alice", address: "alice@example.com" }, type: "required" }],
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
      await client.getEvents("cal-1", {
        start: "2026-06-18T00:00:00",
        end: "2026-06-19T00:00:00",
        limit: 10,
      });

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

    it("handles 429 without Retry-After header (default 1s delay)", async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => null },
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ value: [{ id: "c1", name: "Cal", isDefaultCalendar: true }] }),
        });

      const client = createClient();
      const promise = client.listCalendars();

      await vi.advanceTimersByTimeAsync(1500);
      const calendars = await promise;

      expect(calendars).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("throws after max retries exceeded for 429", async () => {
      const rateLimitedResponse = {
        ok: false,
        status: 429,
        headers: { get: () => "0" },
        json: async () => ({}),
      };

      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(rateLimitedResponse);

      const client = createClient();
      await expect(client.listCalendars()).rejects.toThrow("too many 429 responses");
    });

    it("handles 404 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: { message: "The event was not found" } }),
      });

      const client = createClient();
      await expect(client.deleteEvent("missing")).rejects.toThrow("Graph Calendar API DELETE");
    });

    it("handles API errors without error.message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      });

      const client = createClient();
      await expect(client.listCalendars()).rejects.toThrow("Graph Calendar API GET /me/calendars failed: 500 Internal Server Error");
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
      await expect(client.listCalendars()).rejects.toThrow("Graph Calendar API GET /me/calendars failed: 403");
    });

    it("handles 204 No Content response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      });

      const client = createClient();
      const deleted = await client.deleteEvent("evt-1");
      expect(deleted).toBe(true);
    });
  });

  describe("mapping edge cases", () => {
    it("maps calendar without color", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "c1", name: "Cal", isDefaultCalendar: false }],
        }),
      });

      const client = createClient();
      const calendars = await client.listCalendars();
      expect(calendars[0]).toEqual({ id: "c1", name: "Cal", isDefault: false });
    });

    it("maps event with optional fields", async () => {
      const minimalEvent = {
        id: "evt-2",
        subject: "Min Event",
        start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
        attendees: [],
        isAllDay: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [minimalEvent] }),
      });

      const client = createClient();
      const events = await client.getEvents("cal-1");
      expect(events[0].body).toBeUndefined();
      expect(events[0].location).toBeUndefined();
      expect(events[0].recurrence).toBeUndefined();
    });

    it("maps event with recurrence and optional attendees", async () => {
      const recurringEvent = {
        id: "evt-3",
        subject: "Weekly Standup",
        body: { content: "Sync", contentType: "text" },
        start: { dateTime: "2026-06-18T09:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T09:30:00", timeZone: "UTC" },
        location: { displayName: "Zoom" },
        attendees: [{ emailAddress: { name: "Alice", address: "a@b.com" }, type: "optional" }],
        isAllDay: false,
        recurrence: { pattern: { type: "weekly" } },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [recurringEvent] }),
      });

      const client = createClient();
      const events = await client.getEvents("cal-1");
      expect(events[0].attendees[0].type).toBe("optional");
      expect(events[0].recurrence).toBeDefined();
    });

    it("builds event payload with all optional fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "evt-full" }),
      });

      const client = createClient();
      const eventId = await client.createEvent("cal-1", {
        subject: "Full Event",
        start: { dateTime: "2026-06-18T14:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T15:00:00", timeZone: "UTC" },
        body: "Event description",
        location: "Room A",
        attendees: [{ name: "Alice", address: "a@b.com", type: "optional" }],
        isAllDay: true,
      });

      expect(eventId).toBe("evt-full");
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.body).toEqual({ contentType: "text", content: "Event description" });
      expect(callBody.location).toEqual({ displayName: "Room A" });
      expect(callBody.isAllDay).toBe(true);
    });

    it("updateEvent sends all optional fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "evt-updated" }),
      });

      const client = createClient();
      const eventId = await client.updateEvent("evt-1", {
        subject: "Updated",
        start: { dateTime: "2026-06-19T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-19T11:00:00", timeZone: "UTC" },
        body: "New desc",
        location: "Room B",
        isAllDay: false,
        attendees: [{ name: "Bob", address: "b@c.com" }],
      });

      expect(eventId).toBe("evt-updated");
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(callBody.body).toEqual({ contentType: "text", content: "New desc" });
      expect(callBody.location).toEqual({ displayName: "Room B" });
      expect(callBody.isAllDay).toBe(false);
    });

    it("getEvents without options sends no query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const client = createClient();
      await client.getEvents("cal-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/calendars/cal-1/events",
        expect.anything(),
      );
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
      {
        provider: "graph",
        calendarId: "cal-1",
        start: "2026-06-18T00:00:00",
        end: "2026-06-19T00:00:00",
        limit: 10,
      },
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

describe("calendar_create tool branches", () => {
  it("creates event with all optional fields", async () => {
    const client = createClient();
    vi.spyOn(client, "createEvent").mockResolvedValueOnce("evt-full");

    const tool = createCalendarCreateTool(client);
    const result = await tool.handler(
      {
        provider: "graph",
        calendarId: "cal-1",
        subject: "Full Event",
        start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
        body: "Description",
        location: "Room A",
        attendees: [{ name: "Alice", address: "a@b.com", type: "optional" }],
        isAllDay: true,
      },
      ctx,
    );
    expect(result).toEqual({ eventId: "evt-full" });
    expect(client.createEvent).toHaveBeenCalledWith(
      "cal-1",
      expect.objectContaining({
        body: "Description",
        location: "Room A",
        isAllDay: true,
        attendees: [{ name: "Alice", address: "a@b.com", type: "optional" }],
      }),
    );
  });

  it("creates event with minimal fields", async () => {
    const client = createClient();
    vi.spyOn(client, "createEvent").mockResolvedValueOnce("evt-min");

    const tool = createCalendarCreateTool(client);
    const result = await tool.handler(
      {
        provider: "graph",
        calendarId: "cal-1",
        subject: "Min Event",
        start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
      },
      ctx,
    );
    expect(result).toEqual({ eventId: "evt-min" });
    expect(client.createEvent).toHaveBeenCalledWith(
      "cal-1",
      expect.not.objectContaining({
        body: expect.anything(),
        location: expect.anything(),
        isAllDay: expect.anything(),
      }),
    );
  });
});

describe("calendar_update tool branches", () => {
  it("updates with all optional fields", async () => {
    const client = createClient();
    vi.spyOn(client, "updateEvent").mockResolvedValueOnce("evt-updated");

    const tool = createCalendarUpdateTool(client);
    await tool.handler(
      {
        provider: "graph",
        eventId: "evt-1",
        subject: "Updated",
        start: { dateTime: "2026-06-19T10:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-06-19T11:00:00", timeZone: "UTC" },
        body: "New body",
        location: "Room B",
        isAllDay: false,
        attendees: [{ name: "Alice", address: "a@b.com", type: "required" }],
      },
      ctx,
    );
    expect(client.updateEvent).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({
        subject: "Updated",
        body: "New body",
        location: "Room B",
        isAllDay: false,
      }),
    );
  });

  it("updates with minimal fields", async () => {
    const client = createClient();
    vi.spyOn(client, "updateEvent").mockResolvedValueOnce("evt-updated");

    const tool = createCalendarUpdateTool(client);
    await tool.handler(
      {
        provider: "graph",
        eventId: "evt-1",
        subject: "Updated",
      },
      ctx,
    );
    expect(client.updateEvent).toHaveBeenCalledWith("evt-1", { subject: "Updated" });
  });
});

describe("calendar_get_events tool branches", () => {
  it("calls getEvents with no optional params", async () => {
    const client = createClient();
    vi.spyOn(client, "getEvents").mockResolvedValueOnce([]);

    const tool = createCalendarGetEventsTool(client);
    const result = await tool.handler({ provider: "graph", calendarId: "cal-1" }, ctx);
    expect(result).toEqual({ events: [] });
    expect(client.getEvents).toHaveBeenCalledWith("cal-1", {});
  });
});

describe("GraphCalendarClient recurrence and timezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("tok-123");
  });

  it("creates an event with daily recurrence", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-daily" }),
    });

    const client = createClient();
    const eventId = await client.createEvent("cal-1", {
      subject: "Daily Standup",
      start: { dateTime: "2026-06-18T09:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-06-18T09:15:00", timeZone: "UTC" },
      recurrence: { pattern: "daily", interval: 1 },
    });

    expect(eventId).toBe("evt-daily");
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.recurrence).toEqual({
      pattern: { type: "daily", interval: 1 },
      range: { type: "noEnd", startDate: "2026-06-18" },
    });
  });

  it("creates an event with weekly recurrence on specific days", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-weekly" }),
    });

    const client = createClient();
    const eventId = await client.createEvent("cal-1", {
      subject: "Weekly Meeting",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
      recurrence: { pattern: "weekly", interval: 1, daysOfWeek: [1, 3, 5] },
    });

    expect(eventId).toBe("evt-weekly");
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.recurrence).toEqual({
      pattern: { type: "weekly", interval: 1, daysOfWeek: ["monday", "wednesday", "friday"] },
      range: { type: "noEnd", startDate: "2026-06-18" },
    });
  });

  it("creates an event with a numbered occurrence range", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-numbered" }),
    });

    const client = createClient();
    const eventId = await client.createEvent("cal-1", {
      subject: "Sprint Planning",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
      recurrence: { pattern: "weekly", interval: 2, daysOfWeek: [1], occurrences: 5 },
    });

    expect(eventId).toBe("evt-numbered");
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.recurrence).toEqual({
      pattern: { type: "weekly", interval: 2, daysOfWeek: ["monday"] },
      range: { type: "numbered", startDate: "2026-06-18", numberOfOccurrences: 5 },
    });
  });

  it("creates an event with an endDate range", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-enddate" }),
    });

    const client = createClient();
    const eventId = await client.createEvent("cal-1", {
      subject: "Limited Series",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "UTC" },
      recurrence: { pattern: "monthly", interval: 1, daysOfMonth: [15], endDate: "2026-12-31" },
    });

    expect(eventId).toBe("evt-enddate");
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.recurrence).toEqual({
      pattern: { type: "monthly", interval: 1, daysOfMonth: [15] },
      range: { type: "endDate", startDate: "2026-06-18", endDate: "2026-12-31" },
    });
  });

  it("uses default timezone when none provided", async () => {
    const client = new GraphCalendarClient({
      getToken: mockGetToken,
      fetch: mockFetch,
      defaultTimezone: "America/New_York",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-tz" }),
    });

    const eventId = await client.createEvent("cal-1", {
      subject: "TZ Event",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "" },
    });

    expect(eventId).toBe("evt-tz");
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.start.timeZone).toBe("America/New_York");
    expect(callBody.end.timeZone).toBe("America/New_York");
  });

  it("falls back to UTC when no default timezone and empty timeZone provided", async () => {
    const client = createClient();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-utc" }),
    });

    await client.createEvent("cal-1", {
      subject: "UTC Event",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "" },
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.start.timeZone).toBe("UTC");
    expect(callBody.end.timeZone).toBe("UTC");
  });

  it("preserves explicit timezone even when default is set", async () => {
    const client = new GraphCalendarClient({
      getToken: mockGetToken,
      fetch: mockFetch,
      defaultTimezone: "America/New_York",
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "evt-explicit" }),
    });

    await client.createEvent("cal-1", {
      subject: "Explicit TZ",
      start: { dateTime: "2026-06-18T10:00:00", timeZone: "Europe/London" },
      end: { dateTime: "2026-06-18T11:00:00", timeZone: "Europe/London" },
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.start.timeZone).toBe("Europe/London");
    expect(callBody.end.timeZone).toBe("Europe/London");
  });
});
