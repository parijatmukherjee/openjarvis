import { z } from "zod";

export interface CalendarEvent {
  id: string;
  subject: string;
  body?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
  attendees: Array<{ name: string; address: string; type: "required" | "optional" }>;
  isAllDay: boolean;
  recurrence?: string;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color?: string;
  isDefault: boolean;
}

export interface CreateEventInput {
  subject: string;
  body?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
  attendees?: Array<{ name: string; address: string; type?: "required" | "optional" }>;
  isAllDay?: boolean;
}

export interface CalendarConfig {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export const CalendarInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  isDefault: z.boolean(),
});

export const CalendarEventSchema = z.object({
  id: z.string(),
  subject: z.string(),
  body: z.string().optional(),
  start: z.object({ dateTime: z.string(), timeZone: z.string() }),
  end: z.object({ dateTime: z.string(), timeZone: z.string() }),
  location: z.string().optional(),
  attendees: z.array(
    z.object({ name: z.string(), address: z.string(), type: z.enum(["required", "optional"]) }),
  ),
  isAllDay: z.boolean(),
  recurrence: z.string().optional(),
});

export const CreateEventInputSchema = z.object({
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

export const CalendarListResultSchema = z.object({
  calendars: z.array(CalendarInfoSchema),
});

export const CalendarGetEventsResultSchema = z.object({
  events: z.array(CalendarEventSchema),
});

export const CalendarCreateResultSchema = z.object({
  eventId: z.string(),
});

export const CalendarUpdateResultSchema = z.object({
  eventId: z.string(),
});

export const CalendarDeleteResultSchema = z.object({
  deleted: z.boolean(),
});