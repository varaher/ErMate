import React, { useState } from "react";
import { ProcedureNote } from "../types/procedureNotes";
import { 
  Eye, 
  Edit3, 
  Trash2, 
  FileText, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Printer
} from "lucide-react";

interface ProcedureNoteCardProps {
  note: ProcedureNote;
  onEdit: (note: ProcedureNote) => void;
  onDelete: (noteId: string) => void;
}

export const ProcedureNoteCard: React.FC<ProcedureNoteCardProps> = ({
  note,
  onEdit,
  onDelete,
}) => {
  const [showFullModal, setShowFullModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Category badge colors
  const categoryColor = (() => {
    switch (note.category) {
      case "AIRWAY & BREATHING": return "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "VASCULAR & MONITORING": return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "TUBES & DRAINS": return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "TRAUMA & ORTHOPEDICS": return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "WOUND / MINOR PROCEDURES": return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default: return "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
  })();

  // Short summary builder
  const summaryLine = (() => {
    const parts: string[] = [];
    if (note.metadata.indication) parts.push(`Indication: ${note.metadata.indication}`);
    if (note.metadata.consent === "obtained") parts.push("Consent obtained");
    else if (note.metadata.consent === "emergency_implied") parts.push("Emergency consent");

    if (note.data.type === "foley_catheter" && note.data.fields.catheterSize) {
      parts.push(`${note.data.fields.catheterSize} catheter`);
    } else if (note.data.type === "central_line") {
      const site = [note.data.fields.side, note.data.fields.site].filter(Boolean).join(" ");
      if (site) parts.push(site);
    } else if (note.data.type === "arterial_line") {
      const site = [note.data.fields.side, note.data.fields.site].filter(Boolean).join(" ");
      if (site) parts.push(site);
    } else if (note.data.type === "rsi_intubation") {
      if (note.data.fields.etTubeSize) parts.push(`ETT ${note.data.fields.etTubeSize}`);
    } else if (note.data.type === "closed_reduction") {
      if (note.data.fields.diagnosis) parts.push(note.data.fields.diagnosis);
    } else if (note.data.type === "short_arm_slab") {
      const s = [note.data.fields.side, note.data.fields.site].filter(Boolean).join(" ");
      if (s) parts.push(s);
    } else if (note.data.type === "ryles_tube" && note.data.fields.tubeSize) {
      parts.push(`${note.data.fields.tubeSize} NG tube`);
    }

    if (note.metadata.complications === "none_observed") parts.push("No complications");
    else if (note.metadata.complications === "present") parts.push("Complication noted");

    return parts.join(" • ") || "Structured procedure note recorded";
  })();

  return (
    <>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-2.5">
        <div className="space-y-1.5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${categoryColor}`}>
                {note.category}
              </span>
              <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                {note.procedureName}
              </h5>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium shrink-0">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{[note.metadata.date, note.metadata.time].filter(Boolean).join(" ") || "Time unrecorded"}</span>
            </div>
          </div>

          {/* Performed by & Brief summary */}
          <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
            {note.metadata.performedBy && (
              <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                <User className="w-3 h-3 text-slate-400" />
                {note.metadata.performedBy}
              </span>
            )}
            {note.metadata.assistant && (
              <span className="text-slate-400">
                (Asst: {note.metadata.assistant})
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80">
            {summaryLine}
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => setShowFullModal(true)}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Note</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(note)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 p-0.5 rounded border border-rose-200 dark:border-rose-900">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold px-1">Delete?</span>
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px]"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete procedure note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FULL VIEW MODAL */}
      {showFullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${categoryColor}`}>
                  {note.category}
                </span>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-1">
                  {note.procedureName}
                </h4>
              </div>
              <button
                onClick={() => setShowFullModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                  {note.generatedNarrative}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5">
                <div>Document ID: <code className="text-slate-500">{note.id}</code></div>
                <div>Created: {new Date(note.createdAt).toLocaleString()}</div>
                {note.updatedAt && <div>Last Updated: {new Date(note.updatedAt).toLocaleString()}</div>}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowFullModal(false);
                  onEdit(note);
                }}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Note</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
