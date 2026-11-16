import React, { useState } from "react";
import { X, FileSpreadsheet, Loader2, CalendarCheck, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { authenticateGoogleWorkspace, getRecentSpreadsheets, getSpreadsheetData, WorkspaceError } from "../../services/googleWorkspace";
import { createGoogleCalendarEvent } from "../../services/googleCalendar";
import { authenticatedFetch } from "../../services/authenticatedFetch";
import { publishRota } from "../../services/rotaShifts";
import { normalizeShift, ROTA_PING_LEAD_MIN, SAMPLE_ROTA_TSV, RotaShift } from "../../lib/rotaSync";

interface Props {
  onClose: () => void;
  onSuccess: (count: number) => void;
  teamMembers: { email: string; name: string }[];
}

type Step = "guide" | "auth" | "select" | "parsing" | "review" | "syncing" | "done";
interface Row { shift: any; matchedEmail: string | null; matchedName: string | null; clean: RotaShift | null }
interface Problem { title: string; body: string }

function toProblem(err: any, fallbackTitle: string): Problem {
  if (err instanceof WorkspaceError) return { title: err.title, body: err.message };
  return { title: fallbackTitle, body: err?.message || "Please try again." };
}

export function WorkspaceRotaSyncModal({ onClose, onSuccess, teamMembers }: Props) {
  const [loading, setLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [step, setStep] = useState<Step>("guide");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [validatedRows, setValidatedRows] = useState<Row[]>([]);
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ invites: number; attempted: number; saved: number; doctors: number; calendarNote: string; saveNote: string } | null>(null);

  const connect = async () => {
    setStep("auth");
    setLoading(true);
    setProblem(null);
    try {
      const token = await authenticateGoogleWorkspace();
      const files = await getRecentSpreadsheets(token);
      setSpreadsheets(files);
      setStep("select");
    } catch (err: any) {
      setProblem(toProblem(err, "Could not connect to Google."));
      setStep("guide");
    } finally {
      setLoading(false);
    }
  };

  const copySample = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_ROTA_TSV);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setProblem({ title: "Could not copy.", body: "Your browser blocked copying. Type the six column names yourself: Date, Shift, Doctor, Email, Start, End." });
    }
  };

  const handleSelectFile = async (fileId: string) => {
    setLoading(true);
    setProblem(null);
    setStep("parsing");
    try {
      const token = await authenticateGoogleWorkspace();
      const rows = await getSpreadsheetData(token, fileId);
      if (!rows.length) throw new Error("That sheet is empty. Add your rota on the first tab and try again.");

      const csvData = rows.map((r: any[]) => r.join(",")).join("\n");

      const parseRes = await authenticatedFetch("/api/parse-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, monthYear: new Date().toLocaleDateString() })
      });
      const parseData = await parseRes.json().catch(() => ({}));
      if (!parseData.success) throw new Error(parseData.error || "ErMate could not read that sheet. Check it has the six columns and try again.");

      const shifts = parseData.shifts || [];
      if (shifts.length === 0) throw new Error("No shifts were found. Check the columns: Date, Shift, Doctor, Email, Start, End.");

      // An AI-read email is never trusted on its own: it must exactly match a real team member.
      const rosterByEmail = new Map(teamMembers.map(m => [m.email.toLowerCase().trim(), m.name]));
      const validated: Row[] = shifts.map((shift: any) => {
        const rawEmail = (shift.doctorEmail || "").toLowerCase().trim();
        const matchedName = rosterByEmail.get(rawEmail) || null;
        return { shift, matchedEmail: matchedName ? rawEmail : null, matchedName, clean: normalizeShift(shift) };
      });

      setValidatedRows(validated);
      setConfirmedToken(token);
      setStep("review");
    } catch (err: any) {
      setProblem(toProblem(err, "Could not read that sheet."));
      setStep("select");
    } finally {
      setLoading(false);
    }
  };

  const sendable = (r: Row) => !!r.matchedEmail && !!r.clean;

  const handleConfirmSync = async () => {
    if (!confirmedToken) return;
    setStep("syncing");
    const rowsToSync = validatedRows.filter(sendable);
    setTotal(rowsToSync.length);
    setProgress(0);

    let invites = 0;
    let firstCalendarError = "";
    for (const row of rowsToSync) {
      const clean = row.clean as RotaShift;
      const out = await createGoogleCalendarEvent(confirmedToken, {
        summary: `ER Shift: ${clean.shiftType} - ${row.matchedName}`,
        description: `Rota sent from ErMate\nShift: ${clean.shiftType}`,
        startDateTime: clean.startIso,
        endDateTime: clean.endIso,
        attendeesEmails: [clean.doctorEmail],
        reminderMinutes: ROTA_PING_LEAD_MIN,
      });
      if (out.success) invites++;
      else if (!firstCalendarError) firstCalendarError = out.error || "Google Calendar refused the invite.";
      setProgress(p => p + 1);
    }

    // The ErMate notice and 30-minute ping do not depend on Google Calendar working.
    let saved = 0;
    let doctors = 0;
    let saveNote = "";
    try {
      const pub = await publishRota(rowsToSync.map(r => r.clean as RotaShift));
      saved = pub.saved;
      doctors = pub.doctors;
    } catch (e: any) {
      saveNote = e?.message || "Could not save the rota in ErMate.";
    }

    setResult({ invites, attempted: rowsToSync.length, saved, doctors, calendarNote: firstCalendarError, saveNote });
    setStep("done");
  };

  const finish = () => {
    if (result) onSuccess(result.invites);
    else onClose();
  };

  const skipped = validatedRows.filter(r => !sendable(r)).length;
  const sendCount = validatedRows.filter(sendable).length;
  const doctorCount = new Set(validatedRows.filter(sendable).map(r => r.matchedEmail)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Workspace Rota Sync</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Send your rota as calendar invites and ErMate reminders</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {problem && (
            <div role="alert" className="mb-5 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{problem.title}</p>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-0.5">{problem.body}</p>
              </div>
            </div>
          )}

          {step === "guide" && (
            <div className="space-y-4">
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li>Keep your rota in a <b>Google Sheet</b>. An Excel file in Drive will not show up. Open it in Drive and choose File, Save as Google Sheets.</li>
                <li>Use these columns on the <b>first tab</b>. ErMate reads the first 100 rows.</li>
                <li>Each doctor's email must be the email they joined your team with.</li>
                <li>Tap Connect Google. On the Google screen, <b>tick Drive, Sheets and Calendar</b>.</li>
              </ol>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300">
                    <tr><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Shift</th><th className="px-2 py-1.5">Doctor</th><th className="px-2 py-1.5">Email</th><th className="px-2 py-1.5">Start</th><th className="px-2 py-1.5">End</th></tr>
                  </thead>
                  <tbody className="text-slate-600 dark:text-slate-300">
                    <tr><td className="px-2 py-1">20 Nov</td><td className="px-2 py-1">Morning</td><td className="px-2 py-1">Dr A</td><td className="px-2 py-1">a@…</td><td className="px-2 py-1">08:00</td><td className="px-2 py-1">14:00</td></tr>
                    <tr><td className="px-2 py-1">20 Nov</td><td className="px-2 py-1">Night</td><td className="px-2 py-1">Dr B</td><td className="px-2 py-1">b@…</td><td className="px-2 py-1">20:00</td><td className="px-2 py-1">08:00</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">A night shift that ends the next morning (20:00 to 08:00) is understood.</p>
              <button
                type="button"
                onClick={copySample}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied. Paste it into a new Google Sheet." : "Copy sample rota to paste into a new sheet"}
              </button>
              <button
                type="button"
                onClick={connect}
                className="w-full px-4 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
              >
                {problem ? "Try again" : "Connect Google"}
              </button>
            </div>
          )}

          {step === "auth" && loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Connecting to Google...</p>
              <p className="text-xs text-slate-500 mt-2">Finish the steps in the Google window.</p>
            </div>
          )}

          {step === "select" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select your rota sheet from Drive:</p>
              {spreadsheets.length === 0 && !loading && (
                <div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-bold">No Google Sheets found.</p>
                  <p>Your rota may be an Excel file. In Drive, open it and choose File, Save as Google Sheets. Then try again.</p>
                  <button type="button" onClick={connect} className="mt-2 px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">Try again</button>
                </div>
              )}
              <div className="space-y-2">
                {spreadsheets.map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all text-left group"
                  >
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Review before sending. Only doctors on your team, with a clear shift time, are sent.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {validatedRows.map((row, idx) => {
                  const ok = sendable(row);
                  const why = !row.matchedEmail ? "✗ Not on team, skipped" : !row.clean ? "✗ Time unclear, skipped" : "✓ On your team";
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-sm ${
                        ok
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
                          : "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {row.shift.doctorName || "Unknown"} — {row.shift.shiftType || "Shift"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {row.shift.doctorEmail || "No email read"}
                        </p>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{why}</span>
                    </div>
                  );
                })}
              </div>
              {skipped > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {skipped} skipped. For a doctor not on your team, ask them to join with the team link using the same email as the sheet.
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sendCount} shift{sendCount === 1 ? "" : "s"} for {doctorCount} doctor{doctorCount === 1 ? "" : "s"} will get a Google Calendar email and an ErMate reminder {ROTA_PING_LEAD_MIN} minutes before each shift.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSync}
                  disabled={sendCount === 0}
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  Send to {doctorCount} doctor{doctorCount === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          )}

          {(step === "parsing" || step === "syncing") && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-6" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">
                {step === "parsing" ? "Reading your rota..." : "Sending invites"}
              </h3>
              {step === "syncing" && total > 0 && (
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(progress / total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-500">{progress} of {total} processed</p>
                </div>
              )}
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 dark:text-emerald-200">
                  {result.saved > 0 ? (
                    <p className="font-bold">Rota sent to {result.doctors} doctor{result.doctors === 1 ? "" : "s"} in ErMate.</p>
                  ) : (
                    <p className="font-bold">No ErMate reminders were saved.</p>
                  )}
                  <p className="mt-1">Google Calendar invites: {result.invites} of {result.attempted} sent.</p>
                </div>
              </div>
              {result.calendarNote && (
                <p className="text-xs text-rose-700 dark:text-rose-300">Some invites did not go: {result.calendarNote}</p>
              )}
              {result.saveNote && (
                <p className="text-xs text-rose-700 dark:text-rose-300">{result.saveNote}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If you change the rota later, send it again. ErMate updates the shifts. Google Calendar sends a new invite for each shift, so delete the old events first.
              </p>
              <button onClick={finish} className="w-full px-4 py-2.5 text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}