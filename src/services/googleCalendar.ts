import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

// In-memory token cache (never stored in localStorage or sessionStorage)
let cachedCalendarToken: string | null = null;

export function getCachedCalendarToken(): string | null {
  return cachedCalendarToken;
}

export function clearCachedCalendarToken(): void {
  cachedCalendarToken = null;
}

/**
 * Prompt user to sign in or authorize Google Calendar scopes via Firebase GoogleAuthProvider.
 */
export async function authenticateGoogleCalendar(): Promise<string> {
  if (cachedCalendarToken) {
    return cachedCalendarToken;
  }

  const calendarProvider = new GoogleAuthProvider();
  calendarProvider.setCustomParameters({ prompt: "select_account" });
  calendarProvider.addScope("https://www.googleapis.com/auth/calendar");
  calendarProvider.addScope("https://www.googleapis.com/auth/calendar.events");

  try {
    const result = await signInWithPopup(auth, calendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve Google Calendar access token from login result.");
    }
    cachedCalendarToken = credential.accessToken;
    return cachedCalendarToken;
  } catch (err: any) {
    console.error("[Google Calendar Auth Error]:", err);
    throw new Error(err?.message || "Failed to authenticate with Google Calendar.");
  }
}

export interface GoogleCalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO String or YYYY-MM-DD format
  endDateTime: string;   // ISO String or YYYY-MM-DD format
  timeZone?: string;
  attendeesEmails?: string[];
}

/**
 * Creates a calendar event on the user's primary Google Calendar.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: GoogleCalendarEventPayload
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    const isAllDay = !event.startDateTime.includes("T");
    const payload: any = {
      summary: event.summary,
      description: event.description || "Created via ErMate Emergency Medicine System",
      location: event.location || "Emergency Department",
      start: isAllDay
        ? { date: event.startDateTime }
        : { dateTime: event.startDateTime, timeZone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: isAllDay
        ? { date: event.endDateTime }
        : { dateTime: event.endDateTime, timeZone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    if (event.attendeesEmails && event.attendeesEmails.length > 0) {
      payload.attendees = event.attendeesEmails.map(email => ({ email }));
    }

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `Google Calendar API returned status ${response.status}`;
      // If token expired or invalid, clear cache
      if (response.status === 401) {
        clearCachedCalendarToken();
      }
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.error("[Google Calendar API Error]:", err);
    return {
      success: false,
      error: err?.message || "Failed to reach Google Calendar API.",
    };
  }
}

/**
 * Fetches upcoming events from user's Google Calendar.
 */
export async function getUpcomingGoogleCalendarEvents(
  accessToken: string,
  maxResults: number = 10
): Promise<{ success: boolean; events?: any[]; error?: string }> {
  try {
    const nowISO = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      nowISO
    )}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearCachedCalendarToken();
      }
      return { success: false, error: errorData?.error?.message || `Status ${response.status}` };
    }

    const data = await response.json();
    return { success: true, events: data.items || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch calendar events." };
  }
}
