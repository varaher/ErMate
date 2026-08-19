import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, Loader2, CalendarCheck, AlertCircle } from "lucide-react";
import { authenticateGoogleWorkspace, getRecentSpreadsheets, getSpreadsheetData } from "../../services/googleWorkspace";
import { createGoogleCalendarEvent } from "../../services/googleCalendar";

interface Props {
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function WorkspaceRotaSyncModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"auth" | "select" | "parsing" | "syncing">("auth");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await authenticateGoogleWorkspace();
      const files = await getRecentSpreadsheets(token);
      setSpreadsheets(files);
      setStep("select");
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (fileId: string) => {
    setLoading(true);
    setError(null);
    setStep("parsing");
    try {
      const token = await authenticateGoogleWorkspace();
      const rows = await getSpreadsheetData(token, fileId);
      
      // Convert 2D array to CSV string
      const csvData = rows.map((r: any[]) => r.join(",")).join("\n");
      
      // Send to AI for parsing
      const parseRes = await fetch("/api/parse-rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData, monthYear: new Date().toLocaleDateString() })
      });
      const parseData = await parseRes.json();
      if (!parseData.success) throw new Error(parseData.error || "Failed to parse rota");
      
      const shifts = parseData.shifts || [];
      if (shifts.length === 0) throw new Error("No valid shifts found in the selected file.");
      
      setStep("syncing");
      setTotal(shifts.length);
      
      let successCount = 0;
      for (const shift of shifts) {
        if (!shift.startTime || !shift.endTime || !shift.doctorEmail) {
          setProgress(p => p + 1);
          continue;
        }
        
        let start = shift.startTime;
        let end = shift.endTime;
        
        // Ensure they are ISO strings if they are dates, or if they are just times, we attach the date
        if (!start.includes("T")) {
           // Basic inference: if it's "08:00 AM", attach to shiftDate
           start = new Date(`${shift.shiftDate} ${shift.startTime}`).toISOString();
           end = new Date(`${shift.shiftDate} ${shift.endTime}`).toISOString();
        }
        
        try {
          await createGoogleCalendarEvent(token, {
            summary: `ER Shift: ${shift.shiftType} - ${shift.doctorName}`,
            description: `Automatic Rota Sync\nShift: ${shift.shiftType}`,
            startDateTime: start,
            endDateTime: end,
            attendeesEmails: [shift.doctorEmail]
          });
          successCount++;
        } catch (e) {
          console.warn("Failed to create event for", shift.doctorName, e);
        }
        setProgress(p => p + 1);
      }
      
      onSuccess(successCount);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setStep("select");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Workspace Rota Sync</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Import Google Sheets & Send Invites</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          )}

          {step === "auth" && loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Connecting to Google Workspace...</p>
            </div>
          )}

          {step === "select" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select a Rota spreadsheet from your Drive:</p>
              {spreadsheets.length === 0 && !loading && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No recent spreadsheets found.</p>
              )}
              <div className="space-y-2">
                {spreadsheets.map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group text-left"
                  >
                    <FileSpreadsheet className="w-6 h-6 text-emerald-600 dark:text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1 truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === "parsing" || step === "syncing") && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-6" />
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2">
                {step === "parsing" ? "AI Extacting Shifts..." : "Syncing to Calendar"}
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
              <p className="text-xs text-slate-500 max-w-[250px] mx-auto mt-4">
                We're dispatching Google Calendar invites to residents and consultants.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
