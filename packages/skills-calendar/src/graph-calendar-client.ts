import type { CalendarEvent, CalendarInfo, CreateEventInput, RecurrencePattern } from "./types.js";

const BASE_URL = "https://graph.microsoft.com/v1.0";

const DAY_NAMES: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export interface GraphCalendarClientDeps {
  getToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  defaultTimezone?: string;
}

export class GraphCalendarClient {
  private getToken: () => Promise<string>;
  private fetchImpl: typeof globalThis.fetch;
  private defaultTimezone: string;

  constructor(deps: GraphCalendarClientDeps) {
    this.getToken = deps.getToken;
    this.fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultTimezone = deps.defaultTimezone ?? "UTC";
  }

  private async graphRequest(
    path: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const token = await this.getToken();
    const url = `${BASE_URL}${path}`;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const init: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const res = await this.fetchImpl(url, init);

      if (res.status === 429) {
        if (attempt >= maxRetries) {
          throw new Error(`Graph Calendar API ${method} ${path}: too many 429 responses`);
        }
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500 && attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 100;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Graph Calendar API ${method} ${path} failed: 404 Not found`);
        }
        let msg: string;
        try {
          const resBody = (await res.json()) as { error?: { message?: string } };
          msg = resBody?.error?.message ?? res.statusText;
        } catch {
          msg = res.statusText;
        }
        throw new Error(`Graph Calendar API ${method} ${path} failed: ${res.status} ${msg}`);
      }

      if (res.status === 204) {
        return undefined;
      }

      return res.json();
    }
  }

  private mapCalendar(raw: Record<string, unknown>): CalendarInfo {
    const info: CalendarInfo = {
      id: raw.id as string,
      name: raw.name as string,
      isDefault: (raw.isDefaultCalendar as boolean) ?? false,
    };
    if (raw.color !== undefined) {
      info.color = raw.color as string;
    }
    return info;
  }

  private mapEvent(raw: Record<string, unknown>): CalendarEvent {
    const startObj = raw.start as { dateTime: string; timeZone: string };
    const endObj = raw.end as { dateTime: string; timeZone: string };
    const bodyObj = raw.body as { content?: string; contentType?: string } | undefined;
    const locationObj = raw.location as { displayName?: string } | undefined;
    const attendeesArr = (raw.attendees as Array<Record<string, unknown>> | undefined) ?? [];

    const event: CalendarEvent = {
      id: raw.id as string,
      subject: (raw.subject as string) ?? "",
      start: { dateTime: startObj.dateTime, timeZone: startObj.timeZone },
      end: { dateTime: endObj.dateTime, timeZone: endObj.timeZone },
      attendees: attendeesArr.map((a) => {
        const emailAddress = a.emailAddress as { name: string; address: string };
        const type = (a.type as string) === "optional" ? "optional" : "required";
        return { name: emailAddress.name, address: emailAddress.address, type };
      }),
      isAllDay: (raw.isAllDay as boolean) ?? false,
    };

    if (bodyObj?.content !== undefined) {
      event.body = bodyObj.content;
    }
    if (locationObj?.displayName !== undefined) {
      event.location = locationObj.displayName;
    }
    if (raw.recurrence !== undefined) {
      event.recurrence = JSON.stringify(raw.recurrence);
    }

    return event;
  }

  private mapRecurrence(input: RecurrencePattern, startDate: string): Record<string, unknown> {
    const pattern: Record<string, unknown> = {
      type: input.pattern,
      interval: input.interval,
    };

    if (input.daysOfWeek !== undefined) {
      pattern.daysOfWeek = input.daysOfWeek.map((d) => DAY_NAMES[d] ?? `day${d}`);
    }

    if (input.daysOfMonth !== undefined) {
      pattern.daysOfMonth = input.daysOfMonth;
    }

    const range: Record<string, unknown> = {
      type: "noEnd" as string,
      startDate,
    };

    if (input.endDate !== undefined) {
      range.type = "endDate";
      range.endDate = input.endDate;
    } else if (input.occurrences !== undefined) {
      range.type = "numbered";
      range.numberOfOccurrences = input.occurrences;
    }

    return { pattern, range };
  }

  private buildEventPayload(input: CreateEventInput): Record<string, unknown> {
    const start = {
      dateTime: input.start.dateTime,
      timeZone: input.start.timeZone || this.defaultTimezone,
    };
    const end = {
      dateTime: input.end.dateTime,
      timeZone: input.end.timeZone || this.defaultTimezone,
    };

    const payload: Record<string, unknown> = {
      subject: input.subject,
      start,
      end,
      isAllDay: input.isAllDay ?? false,
    };

    if (input.body !== undefined) {
      payload.body = { contentType: "text", content: input.body };
    }

    if (input.location !== undefined) {
      payload.location = { displayName: input.location };
    }

    if (input.attendees !== undefined) {
      payload.attendees = input.attendees.map((a) => ({
        emailAddress: { name: a.name, address: a.address },
        type: a.type ?? "required",
      }));
    }

    if (input.recurrence !== undefined) {
      payload.recurrence = this.mapRecurrence(input.recurrence, start.dateTime.slice(0, 10));
    }

    return payload;
  }

  async listCalendars(): Promise<CalendarInfo[]> {
    const data = (await this.graphRequest("/me/calendars", "GET")) as {
      value: Array<Record<string, unknown>>;
    };
    return data.value.map((c) => this.mapCalendar(c));
  }

  async getEvents(
    calendarId: string,
    opts?: { start?: string; end?: string; limit?: number },
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    if (opts?.start) {
      params.set("startDateTime", opts.start);
    }
    if (opts?.end) {
      params.set("endDateTime", opts.end);
    }
    if (opts?.limit) {
      params.set("$top", String(opts.limit));
    }
    const qs = params.toString();
    const path = `/me/calendars/${calendarId}/events${qs ? `?${qs}` : ""}`;
    const data = (await this.graphRequest(path, "GET")) as {
      value: Array<Record<string, unknown>>;
    };
    return data.value.map((e) => this.mapEvent(e));
  }

  async createEvent(calendarId: string, input: CreateEventInput): Promise<string> {
    const payload = this.buildEventPayload(input);
    const data = (await this.graphRequest(
      `/me/calendars/${calendarId}/events`,
      "POST",
      payload,
    )) as Record<string, unknown>;
    return data.id as string;
  }

  async updateEvent(eventId: string, input: Partial<CreateEventInput>): Promise<string> {
    const payload: Record<string, unknown> = {};
    if (input.subject !== undefined) {
      payload.subject = input.subject;
    }
    if (input.start !== undefined) {
      payload.start = input.start;
    }
    if (input.end !== undefined) {
      payload.end = input.end;
    }
    if (input.body !== undefined) {
      payload.body = { contentType: "text", content: input.body };
    }
    if (input.location !== undefined) {
      payload.location = { displayName: input.location };
    }
    if (input.isAllDay !== undefined) {
      payload.isAllDay = input.isAllDay;
    }
    if (input.attendees !== undefined) {
      payload.attendees = input.attendees.map((a) => ({
        emailAddress: { name: a.name, address: a.address },
        type: a.type ?? "required",
      }));
    }

    const data = (await this.graphRequest(`/me/events/${eventId}`, "PATCH", payload)) as Record<
      string,
      unknown
    >;
    return data.id as string;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    await this.graphRequest(`/me/events/${eventId}`, "DELETE");
    return true;
  }
}
