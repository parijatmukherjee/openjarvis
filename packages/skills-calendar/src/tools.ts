import { z } from "zod";
import type { ToolDefinition } from "@openjarvis/core";
import type { CalendarInfo, CalendarEvent, CreateEventInput } from "./types.js";
import {
  CalendarListResultSchema,
  CalendarGetEventsResultSchema,
  CalendarCreateResultSchema,
  CalendarUpdateResultSchema,
  CalendarDeleteResultSchema,
} from "./types.js";
import { GraphCalendarClient } from "./graph-calendar-client.js";

const CalendarListArgsSchema = z.object({
  provider: z.enum(["graph"]).optional().default("graph"),
});

type CalendarListArgs = z.infer<typeof CalendarListArgsSchema>;

export function createCalendarListTool(
  client: GraphCalendarClient,
): ToolDefinition<CalendarListArgs, { calendars: CalendarInfo[] }> {
  return {
    name: "calendar_list",
    description: "List available calendars",
    args: CalendarListArgsSchema as unknown as z.ZodType<CalendarListArgs>,
    result: CalendarListResultSchema as unknown as z.ZodType<{ calendars: CalendarInfo[] }>,
    capabilities: [{ name: "calendar:read" as const }],
    handler: async (_args) => {
      const calendars = await client.listCalendars();
      return { calendars };
    },
  };
}

const CalendarGetEventsArgsSchema = z.object({
  provider: z.enum(["graph"]).optional().default("graph"),
  calendarId: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.number().optional(),
});

type CalendarGetEventsArgs = z.infer<typeof CalendarGetEventsArgsSchema>;

export function createCalendarGetEventsTool(
  client: GraphCalendarClient,
): ToolDefinition<CalendarGetEventsArgs, { events: CalendarEvent[] }> {
  return {
    name: "calendar_get_events",
    description: "Get events for a calendar",
    args: CalendarGetEventsArgsSchema as unknown as z.ZodType<CalendarGetEventsArgs>,
    result: CalendarGetEventsResultSchema as unknown as z.ZodType<{ events: CalendarEvent[] }>,
    capabilities: [{ name: "calendar:read" as const }],
    handler: async (args) => {
      const opts: { start?: string; end?: string; limit?: number } = {};
      if (args.start !== undefined) {
        opts.start = args.start;
      }
      if (args.end !== undefined) {
        opts.end = args.end;
      }
      if (args.limit !== undefined) {
        opts.limit = args.limit;
      }
      const events = await client.getEvents(args.calendarId, opts);
      return { events };
    },
  };
}

const CalendarCreateArgsSchema = z.object({
  provider: z.enum(["graph"]).optional().default("graph"),
  calendarId: z.string(),
  subject: z.string(),
  body: z.string().optional(),
  start: z.object({ dateTime: z.string(), timeZone: z.string() }),
  end: z.object({ dateTime: z.string(), timeZone: z.string() }),
  location: z.string().optional(),
  attendees: z
    .array(z.object({ name: z.string(), address: z.string(), type: z.enum(["required", "optional"]).optional() }))
    .optional(),
  isAllDay: z.boolean().optional(),
});

type CalendarCreateArgs = z.infer<typeof CalendarCreateArgsSchema>;

export function createCalendarCreateTool(
  client: GraphCalendarClient,
): ToolDefinition<CalendarCreateArgs, { eventId: string }> {
  return {
    name: "calendar_create",
    description: "Create a calendar event",
    args: CalendarCreateArgsSchema as unknown as z.ZodType<CalendarCreateArgs>,
    result: CalendarCreateResultSchema as unknown as z.ZodType<{ eventId: string }>,
    capabilities: [{ name: "calendar:write" as const }],
    handler: async (args) => {
      const input: CreateEventInput = {
        subject: args.subject,
        start: args.start,
        end: args.end,
      };
      if (args.body !== undefined) {
        input.body = args.body;
      }
      if (args.location !== undefined) {
        input.location = args.location;
      }
      if (args.attendees !== undefined) {
        input.attendees = args.attendees.map((a) => ({
          name: a.name,
          address: a.address,
          ...(a.type !== undefined && { type: a.type }),
        }));
      }
      if (args.isAllDay !== undefined) {
        input.isAllDay = args.isAllDay;
      }
      const eventId = await client.createEvent(args.calendarId, input);
      return { eventId };
    },
  };
}

const CalendarUpdateArgsSchema = z.object({
  provider: z.enum(["graph"]).optional().default("graph"),
  eventId: z.string(),
  subject: z.string().optional(),
  body: z.string().optional(),
  start: z.object({ dateTime: z.string(), timeZone: z.string() }).optional(),
  end: z.object({ dateTime: z.string(), timeZone: z.string() }).optional(),
  location: z.string().optional(),
  attendees: z
    .array(z.object({ name: z.string(), address: z.string(), type: z.enum(["required", "optional"]).optional() }))
    .optional(),
  isAllDay: z.boolean().optional(),
});

type CalendarUpdateArgs = z.infer<typeof CalendarUpdateArgsSchema>;

export function createCalendarUpdateTool(
  client: GraphCalendarClient,
): ToolDefinition<CalendarUpdateArgs, { eventId: string }> {
  return {
    name: "calendar_update",
    description: "Update a calendar event",
    args: CalendarUpdateArgsSchema as unknown as z.ZodType<CalendarUpdateArgs>,
    result: CalendarUpdateResultSchema as unknown as z.ZodType<{ eventId: string }>,
    capabilities: [{ name: "calendar:write" as const }],
    handler: async (args) => {
      const input: Partial<CreateEventInput> = {};
      if (args.subject !== undefined) {
        input.subject = args.subject;
      }
      if (args.start !== undefined) {
        input.start = args.start;
      }
      if (args.end !== undefined) {
        input.end = args.end;
      }
      if (args.body !== undefined) {
        input.body = args.body;
      }
      if (args.location !== undefined) {
        input.location = args.location;
      }
      if (args.isAllDay !== undefined) {
        input.isAllDay = args.isAllDay;
      }
      if (args.attendees !== undefined) {
        input.attendees = args.attendees.map((a) => ({
          name: a.name,
          address: a.address,
          ...(a.type !== undefined && { type: a.type }),
        }));
      }
      const eventId = await client.updateEvent(args.eventId, input);
      return { eventId };
    },
  };
}

const CalendarDeleteArgsSchema = z.object({
  provider: z.enum(["graph"]).optional().default("graph"),
  eventId: z.string(),
});

type CalendarDeleteArgs = z.infer<typeof CalendarDeleteArgsSchema>;

export function createCalendarDeleteTool(
  client: GraphCalendarClient,
): ToolDefinition<CalendarDeleteArgs, { deleted: boolean }> {
  return {
    name: "calendar_delete",
    description: "Delete a calendar event",
    args: CalendarDeleteArgsSchema as unknown as z.ZodType<CalendarDeleteArgs>,
    result: CalendarDeleteResultSchema as unknown as z.ZodType<{ deleted: boolean }>,
    capabilities: [{ name: "calendar:write" as const }],
    handler: async (args) => {
      const deleted = await client.deleteEvent(args.eventId);
      return { deleted };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export function registerCalendarTools(
  registry: { register(tool: AnyToolDefinition): void },
  client: GraphCalendarClient,
): void {
  registry.register(createCalendarListTool(client));
  registry.register(createCalendarGetEventsTool(client));
  registry.register(createCalendarCreateTool(client));
  registry.register(createCalendarUpdateTool(client));
  registry.register(createCalendarDeleteTool(client));
}