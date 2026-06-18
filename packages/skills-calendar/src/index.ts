export type {
  CalendarEvent,
  CalendarInfo,
  CreateEventInput,
  CalendarConfig,
} from "./types.js";
export {
  CalendarInfoSchema,
  CalendarEventSchema,
  CreateEventInputSchema,
  CalendarListResultSchema,
  CalendarGetEventsResultSchema,
  CalendarCreateResultSchema,
  CalendarUpdateResultSchema,
  CalendarDeleteResultSchema,
} from "./types.js";
export { GraphCalendarClient } from "./graph-calendar-client.js";
export type { GraphCalendarClientDeps } from "./graph-calendar-client.js";
export {
  createCalendarListTool,
  createCalendarGetEventsTool,
  createCalendarCreateTool,
  createCalendarUpdateTool,
  createCalendarDeleteTool,
  registerCalendarTools,
} from "./tools.js";