import React, { useState, useEffect } from "react";
import { 
  Calendar, X, Check, AlertCircle, Clock, Plus, ExternalLink, 
  Sparkles, RefreshCw, UserCheck, Shield, CheckCircle2, Building2
} from "lucide-react";
import { 
  authenticateGoogleCalendar, 
  createGoogleCalendarEvent, 
  getUpcomingGoogleCalendarEvents, 
  getCachedCalendarToken, 
  clearCachedCalendarToken,
  GoogleCalendarEventPayload 
} from "../services/googleCalendar";

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEventType?: "shift" | "audit" | "handover";
  initialTitle?: string;
  initialDescription?: string;
  initialDate?: string; // YYYY-MM-DD
  initialStartTime?: string; // HH:MM
  initialEndTime?: string; // HH:MM
  hospitalName?: string;
}

export default function GoogleCalendarModal({
  isOpen,
  onClose,
  defaultEventType = "shift",
  initialTitle = "",
  initialDescription = "",
  initialDate = new Date().toISOString().split("T")[0],
  initialStartTime = "08:00",
  initialEndTime = "14:00",
  hospitalName = "Emergency Department",
}: GoogleCalendarModalProps) {
  const [token, setToken] = useState<string | null>(getCachedCalendarToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form states
  const [eventType, setEventType] = useState<"shift" | "audit" | "handover">(defaultEventType);
  const [eventTitle, setEventTitle] = useState(initialTitle || "Emergency Duty Shift — Morning");
  const [eventDescription, setEventDescription] = useState(
    initialDescription || `ErMate Duty Shift scheduled at ${hospitalName}.`
  );
  const [eventLocation, setEventLocation] = useState(hospitalName);
  const [eventDate, setEventDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);

  // Status states
  const [isCreating, setIsCreating] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [createdEventUrl, setCreatedEventUrl] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Upcoming events
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchUpcoming();
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (initialTitle) setEventTitle(initialTitle);
    if (initialDescription) setEventDescription(initialDescription);
  }, [initialTitle, initialDescription]);

  const fetchUpcoming = async () => {
    const t = getCachedCalendarToken();
    if (!t) return;
    setIsLoadingEvents(true);
    const result = await getUpcomingGoogleCalendarEvents(t, 6);
    setIsLoadingEvents(false);
    if (result.success && result.events) {
      setUpcomingEvents(result.events);
    } else if (result.error?.includes("401") || result.error?.includes("token")) {
      setToken(null);
      clearCachedCalendarToken();
    }
  };

  const handleLogin = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const accessToken = await authenticateGoogleCalendar();
      setToken(accessToken);
      setIsAuthenticating(false);
      fetchUpcoming();
    } catch (err: any) {
      setIsAuthenticating(false);
      setAuthError(err?.message || "Google Calendar sign in failed.");
    }
  };

  const handleQuickPreset = (type: "shift" | "audit" | "handover") => {
    setEventType(type);
    const today = new Date().toISOString().split("T")[0];
    setEventDate(today);

    if (type === "shift") {
      setEventTitle(`ER Duty Shift — Morning (${hospitalName})`);
      setEventDescription(`Assigned Clinical Duty Shift at ${hospitalName} Emergency Department.`);
      setStartTime("08:00");
      setEndTime("14:00");
    } else if (type === "audit") {
      setEventTitle(`M&M Mortality Audit Review — Clinical Case`);
      setEventDescription(`Confidential Mortality & Morbidity (M&M) Quality Improvement Committee Review meeting.`);
      setStartTime("15:00");
      setEndTime("16:00");
    } else if (type === "handover") {
      setEventTitle(`Clinical Shift Handover Briefing`);
      setEventDescription(`Department shift handover and active patient roster synchronization.`);
      setStartTime("07:45");
      setEndTime("08:15");
    }
  };

  const handlePromptConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setShowConfirmation(true);
  };

  const handleExecuteCreateEvent = async () => {
    setShowConfirmation(false);
    setIsCreating(true);
    setCreationError(null);
    setCreationSuccess(null);

    let activeToken = token || getCachedCalendarToken();
    if (!activeToken) {
      try {
        activeToken = await authenticateGoogleCalendar();
        setToken(activeToken);
      } catch (err: any) {
        setIsCreating(false);
        setCreationError("Please sign in with Google Calendar first.");
        return;
      }
    }

    const startDateTime = `${eventDate}T${startTime}:00`;
    const endDateTime = `${eventDate}T${endTime}:00`;

    const payload: GoogleCalendarEventPayload = {
      summary: eventTitle,
      description: eventDescription,
      location: eventLocation,
      startDateTime,
      endDateTime,
    };

    const res = await createGoogleCalendarEvent(activeToken, payload);
    setIsCreating(false);

    if (res.success) {
      setCreationSuccess("Event created successfully in your Google Calendar!");
      setCreatedEventUrl(res.htmlLink || null);
      fetchUpcoming();
    } else {
      setCreationError(res.error || "Failed to add event to Google Calendar.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl border border-white/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                Google Calendar Sync
                <span className="text-[10px] bg-white/20 text-white font-mono px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold">
                  Official OAuth
                </span>
              </h3>
              <p className="text-xs text-blue-100">Schedule clinical shifts, M&M audits, and handover briefings seamlessly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-100">
          
          {/* Auth Banner */}
          {!token ? (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Connect Google Calendar</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Authorize ErMate to manage your emergency duty schedule and clinical events securely with your permission.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogin}
                disabled={isAuthenticating}
                className="gsi-material-button text-xs font-bold px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
                <span>{isAuthenticating ? "Authenticating..." : "Sign in with Google"}</span>
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Google Calendar connected & active
              </span>
              <button
                onClick={() => {
                  clearCachedCalendarToken();
                  setToken(null);
                }}
                className="text-[11px] underline hover:text-emerald-900 cursor-pointer font-semibold"
              >
                Disconnect
              </button>
            </div>
          )}

          {authError && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Event Type Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset("shift")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  eventType === "shift"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                🏥 ER Duty Shift
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("audit")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  eventType === "audit"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                💀 M&M Audit Review
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("handover")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  eventType === "handover"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                📋 Shift Handover
              </button>
            </div>
          </div>

          {/* Event Details Form */}
          <form onSubmit={handlePromptConfirmation} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g., ER Duty Shift — Morning"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Hospital / Location
              </label>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="e.g., General Hospital ER"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Description & Notes
              </label>
              <textarea
                rows={3}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Enter event details, shift requirements, or meeting agenda..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Sync Event to Google Calendar</span>
              </button>
            </div>
          </form>

          {/* Creation Status Messages */}
          {creationSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{creationSuccess}</span>
              </div>
              {createdEventUrl && (
                <a
                  href={createdEventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <span>Open Event</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {creationError && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{creationError}</span>
            </div>
          )}

          {/* Upcoming Google Calendar Events Feed */}
          {token && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Upcoming Google Calendar Events</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchUpcoming}
                  disabled={isLoadingEvents}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingEvents ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingEvents ? (
                <p className="text-xs text-slate-400 py-2 text-center">Loading upcoming calendar events...</p>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No upcoming events found on your primary Google Calendar.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {upcomingEvents.map((ev, idx) => {
                    const startStr = ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ev.start?.date || "All Day";
                    return (
                      <div
                        key={ev.id || idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">{ev.summary || "Untitled Event"}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{startStr}</span>
                            {ev.location && <span>• {ev.location}</span>}
                          </p>
                        </div>
                        {ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                            title="View in Google Calendar"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>Google Workspace OAuth Permission Model</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>

      {/* Confirmation Dialog (Mandatory User Confirmation for Calendar Mutations) */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <Calendar className="w-6 h-6" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Confirm Google Calendar Entry</h4>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <p><strong className="text-slate-800 dark:text-white">Title:</strong> {eventTitle}</p>
              <p><strong className="text-slate-800 dark:text-white">Date:</strong> {eventDate}</p>
              <p><strong className="text-slate-800 dark:text-white">Time:</strong> {startTime} - {endTime}</p>
              <p><strong className="text-slate-800 dark:text-white">Location:</strong> {eventLocation}</p>
            </div>
            <p className="text-xs text-slate-500">
              Are you sure you want to add this event to your primary Google Calendar account?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCreateEvent}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Confirm & Sync
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
