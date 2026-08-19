import React, { useState, useEffect } from "react";
import { 
  GraduationCap, X, Check, AlertCircle, Clock, Plus, ExternalLink, 
  RefreshCw, Shield, CheckCircle2, BookOpen, Users, Megaphone,
  FileText, Award, Calendar, Send, ChevronRight, Layers, Sparkles
} from "lucide-react";
import { 
  authenticateGoogleClassroom,
  listClassroomCourses,
  createClassroomCourse,
  listCourseWork,
  createCourseWork,
  listAnnouncements,
  createAnnouncement,
  listCourseStudents,
  listStudentSubmissions,
  getCachedClassroomToken,
  clearCachedClassroomToken,
  ClassroomCourse,
  ClassroomCourseWork,
  ClassroomAnnouncement
} from "../services/googleClassroom";

interface GoogleClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalName?: string;
  userRole?: string;
}

export default function GoogleClassroomModal({
  isOpen,
  onClose,
  hospitalName = "Emergency Department",
  userRole = "Consultant"
}: GoogleClassroomModalProps) {
  const [token, setToken] = useState<string | null>(getCachedClassroomToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data states
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<ClassroomCourse | null>(null);

  // Sub-tab within selected course
  const [activeCourseTab, setActiveCourseTab] = useState<"coursework" | "announcements" | "roster">("coursework");

  // Course content states
  const [courseWorkList, setCourseWorkList] = useState<ClassroomCourseWork[]>([]);
  const [announcementList, setAnnouncementList] = useState<ClassroomAnnouncement[]>([]);
  const [studentList, setStudentList] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Form modals / creation states
  const [showCreateCourseForm, setShowCreateCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("EM Residency Clinical Training");
  const [newCourseSection, setNewCourseSection] = useState("Emergency Medicine");
  const [newCourseRoom, setNewCourseRoom] = useState("ER Seminar Room 1");
  const [newCourseDesc, setNewCourseDesc] = useState(`Clinical education, residency drills, and M&M case reviews at ${hospitalName}.`);

  const [showCreateAssignmentForm, setShowCreateAssignmentForm] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("M&M Case Study Analysis: Airway Management");
  const [assignmentDesc, setAssignmentDesc] = useState("Review the difficult airway case from shift logs. Submit a 2-page clinical rationale and ATLS airway algorithm compliance analysis.");
  const [assignmentPoints, setAssignmentPoints] = useState(100);

  const [showCreateAnnouncementForm, setShowCreateAnnouncementForm] = useState(false);
  const [announcementText, setAnnouncementText] = useState(`[Notice] Clinical Journal Club & M&M Audit review meeting scheduled for Friday at 08:00 in ${newCourseRoom}.`);

  // Confirmation dialog state (Mandatory for API Mutations)
  const [pendingAction, setPendingAction] = useState<{
    type: "CREATE_COURSE" | "CREATE_ASSIGNMENT" | "CREATE_ANNOUNCEMENT";
    title: string;
    details: string;
    execute: () => Promise<void>;
  } | null>(null);

  // Status message state
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string; link?: string } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchCourses();
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (selectedCourse && selectedCourse.id && token) {
      fetchCourseDetails(selectedCourse.id);
    }
  }, [selectedCourse, activeCourseTab, token]);

  const fetchCourses = async () => {
    const t = token || getCachedClassroomToken();
    if (!t) return;
    setIsLoadingCourses(true);
    setStatusMessage(null);
    const result = await listClassroomCourses(t);
    setIsLoadingCourses(false);

    if (result.success && result.courses) {
      setCourses(result.courses);
      if (result.courses.length > 0 && !selectedCourse) {
        setSelectedCourse(result.courses[0]);
      }
    } else if (result.error?.includes("401") || result.error?.includes("token")) {
      setToken(null);
      clearCachedClassroomToken();
      setAuthError("Session expired. Please sign in with Google Classroom again.");
    } else {
      setAuthError(result.error || "Failed to fetch Google Classroom courses.");
    }
  };

  const fetchCourseDetails = async (courseId: string) => {
    const t = token || getCachedClassroomToken();
    if (!t) return;
    setIsLoadingDetails(true);

    if (activeCourseTab === "coursework") {
      const res = await listCourseWork(t, courseId);
      if (res.success && res.courseWork) {
        setCourseWorkList(res.courseWork);
      }
    } else if (activeCourseTab === "announcements") {
      const res = await listAnnouncements(t, courseId);
      if (res.success && res.announcements) {
        setAnnouncementList(res.announcements);
      }
    } else if (activeCourseTab === "roster") {
      const res = await listCourseStudents(t, courseId);
      if (res.success && res.students) {
        setStudentList(res.students);
      }
    }

    setIsLoadingDetails(false);
  };

  const handleLogin = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const accessToken = await authenticateGoogleClassroom();
      setToken(accessToken);
      setIsAuthenticating(false);
      fetchCourses();
    } catch (err: any) {
      setIsAuthenticating(false);
      setAuthError(err?.message || "Google Classroom authentication failed.");
    }
  };

  // Preset handlers
  const handlePresetAssignment = (type: "airway" | "trauma" | "pediatric" | "ecg") => {
    if (type === "airway") {
      setAssignmentTitle("M&M Difficult Airway Algorithm Review");
      setAssignmentDesc("Review the recent emergency intubation case log. Outline the LEMON assessment, video laryngoscopy preparation, and rescue surgical airway protocol.");
      setAssignmentPoints(100);
    } else if (type === "trauma") {
      setAssignmentTitle("ATLS Primary & Secondary Survey Drill");
      setAssignmentDesc("Draft a systematic resuscitation protocol for a multi-trauma motor vehicle collision patient with unstable vitals and massive hemothorax.");
      setAssignmentPoints(100);
    } else if (type === "pediatric") {
      setAssignmentTitle("PALS Pediatric Anaphylaxis & Dosage Drill");
      setAssignmentDesc("Calculate IM Epinephrine, IV fluids, and Steroid dosages for a 14kg pediatric anaphylaxis presentation using weight-based dosing formulas.");
      setAssignmentPoints(50);
    } else if (type === "ecg") {
      setAssignmentTitle("ECG Challenge: STEMI Equivalent & Arrhythmia Identification");
      setAssignmentDesc("Analyze the attached 12-lead ECGs for Sgarbossa criteria, De Winter T-waves, and VTach vs SVT with aberrancy differentiation.");
      setAssignmentPoints(100);
    }
  };

  // Actions wrapped in MANDATORY USER CONFIRMATION
  const promptCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingAction({
      type: "CREATE_COURSE",
      title: "Confirm Google Classroom Creation",
      details: `You are creating a new Google Classroom course titled "${newCourseName}" (${newCourseSection}) hosted at ${newCourseRoom}.`,
      execute: executeCreateCourse
    });
  };

  const executeCreateCourse = async () => {
    const t = token || getCachedClassroomToken();
    if (!t) return;
    setIsExecuting(true);
    setStatusMessage(null);

    const res = await createClassroomCourse(t, {
      name: newCourseName,
      section: newCourseSection,
      room: newCourseRoom,
      description: newCourseDesc
    });

    setIsExecuting(false);
    setShowCreateCourseForm(false);

    if (res.success && res.course) {
      setStatusMessage({
        type: "success",
        text: `Course "${res.course.name}" created successfully on Google Classroom!`,
        link: res.course.alternateLink
      });
      fetchCourses();
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create Google Classroom course." });
    }
  };

  const promptCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse?.id) return;
    setPendingAction({
      type: "CREATE_ASSIGNMENT",
      title: "Confirm Google Coursework Assignment",
      details: `Publish assignment "${assignmentTitle}" (${assignmentPoints} pts) to course "${selectedCourse.name}"?`,
      execute: executeCreateAssignment
    });
  };

  const executeCreateAssignment = async () => {
    const t = token || getCachedClassroomToken();
    if (!t || !selectedCourse?.id) return;
    setIsExecuting(true);
    setStatusMessage(null);

    const res = await createCourseWork(t, selectedCourse.id, {
      title: assignmentTitle,
      description: assignmentDesc,
      maxPoints: assignmentPoints,
      workType: "ASSIGNMENT"
    });

    setIsExecuting(false);
    setShowCreateAssignmentForm(false);

    if (res.success && res.courseWork) {
      setStatusMessage({
        type: "success",
        text: `Assignment "${res.courseWork.title}" published to Google Classroom!`,
        link: res.courseWork.alternateLink
      });
      fetchCourseDetails(selectedCourse.id);
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to publish assignment." });
    }
  };

  const promptCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse?.id) return;
    setPendingAction({
      type: "CREATE_ANNOUNCEMENT",
      title: "Confirm Google Classroom Announcement",
      details: `Post notice to "${selectedCourse.name}": "${announcementText.slice(0, 80)}..."?`,
      execute: executeCreateAnnouncement
    });
  };

  const executeCreateAnnouncement = async () => {
    const t = token || getCachedClassroomToken();
    if (!t || !selectedCourse?.id) return;
    setIsExecuting(true);
    setStatusMessage(null);

    const res = await createAnnouncement(t, selectedCourse.id, announcementText);

    setIsExecuting(false);
    setShowCreateAnnouncementForm(false);

    if (res.success && res.announcement) {
      setStatusMessage({
        type: "success",
        text: "Announcement posted to Google Classroom feed!",
        link: res.announcement.alternateLink
      });
      fetchCourseDetails(selectedCourse.id);
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to post announcement." });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-2xl border border-white/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                Google Classroom Residency Portal
                <span className="text-[10px] bg-white/20 text-white font-mono px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold">
                  Official OAuth
                </span>
              </h3>
              <p className="text-xs text-emerald-100">Synchronize medical residency courses, M&M audits, clinical coursework & student rosters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 dark:text-slate-100">
          
          {/* Auth Banner */}
          {!token ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Connect Google Classroom Account</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Authenticate ErMate to manage medical courses, issue residency assignments, and post announcements with user permission.
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
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span>{isAuthenticating ? "Connecting..." : "Sign in with Google"}</span>
                </button>
              </div>

              {/* Step-by-Step OAuth Security Notice */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 font-mono leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>How to authorize when Google shows "Google hasn't verified this app":</span>
                </div>
                <div className="pl-5 text-[10.5px] space-y-0.5 text-slate-700 dark:text-slate-300">
                  <p>1. Click <strong>"Sign in with Google"</strong> above and pick your Google account.</p>
                  <p>2. If Google displays <em>"Google hasn't verified this app"</em>, look at the bottom-left and click <strong className="text-amber-600 dark:text-amber-400">"Advanced"</strong>.</p>
                  <p>3. Click <strong className="text-amber-600 dark:text-amber-400 font-bold">"Go to ErMate (unsafe)"</strong>.</p>
                  <p>4. Check all Classroom permission checkboxes and click <strong>"Continue"</strong> to finish linking.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Google Classroom API authenticated & synchronized
              </span>
              <button
                onClick={() => {
                  clearCachedClassroomToken();
                  setToken(null);
                  setCourses([]);
                  setSelectedCourse(null);
                }}
                className="text-[11px] underline hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer font-semibold"
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

          {statusMessage && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
              statusMessage.type === "success" 
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            }`}>
              <div className="flex items-center gap-2">
                {statusMessage.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{statusMessage.text}</span>
              </div>
              {statusMessage.link && (
                <a
                  href={statusMessage.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 hover:bg-emerald-700 transition-colors shrink-0"
                >
                  <span>Open in Classroom</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {token && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* Left Sidebar: Course Selection */}
              <div className="md:col-span-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Your Courses ({courses.length})</span>
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={fetchCourses}
                      disabled={isLoadingCourses}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      title="Refresh courses"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCourses ? "animate-spin text-emerald-500" : ""}`} />
                    </button>
                    <button
                      onClick={() => setShowCreateCourseForm(!showCreateCourseForm)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Course</span>
                    </button>
                  </div>
                </div>

                {/* Create Course Form Dropdown */}
                {showCreateCourseForm && (
                  <form onSubmit={promptCreateCourse} className="bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl space-y-2.5 animate-fade-in text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                      <span>Create Medical Course</span>
                      <button type="button" onClick={() => setShowCreateCourseForm(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Course Name</label>
                      <input
                        type="text"
                        required
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Department / Section</label>
                      <input
                        type="text"
                        value={newCourseSection}
                        onChange={(e) => setNewCourseSection(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Room / Hall</label>
                      <input
                        type="text"
                        value={newCourseRoom}
                        onChange={(e) => setNewCourseRoom(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isExecuting}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Course on Google</span>
                    </button>
                  </form>
                )}

                {/* Course List Cards */}
                {isLoadingCourses ? (
                  <p className="text-xs text-slate-400 py-4 text-center font-mono">Fetching Google Classroom courses...</p>
                ) : courses.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-500 space-y-2">
                    <p>No active courses found on your Google Classroom account.</p>
                    <p className="text-[11px] text-slate-400">Click "New Course" above to instantiate an Emergency Medicine Residency module.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {courses.map((c, idx) => {
                      const isSelected = selectedCourse?.id === c.id;
                      return (
                        <div
                          key={`${c.id}-${idx}`}
                          onClick={() => setSelectedCourse(c)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                              : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <h5 className="font-bold text-xs line-clamp-1">{c.name}</h5>
                            {c.alternateLink && (
                              <a
                                href={c.alternateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`p-1 rounded-lg transition-colors ${
                                  isSelected ? "hover:bg-white/20 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                                }`}
                                title="Open in Google Classroom"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 ${isSelected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {c.section || "Emergency Medicine"} {c.room ? `• ${c.room}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Content Area: Active Course Workspace */}
              <div className="md:col-span-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 min-h-[400px]">
                
                {selectedCourse ? (
                  <>
                    {/* Selected Course Header */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          {selectedCourse.name}
                          {selectedCourse.courseState && (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold px-2 py-0.5 rounded uppercase">
                              {selectedCourse.courseState}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {selectedCourse.section || "Emergency Medicine"} {selectedCourse.room ? `• Room: ${selectedCourse.room}` : ""}
                        </p>
                      </div>

                      {/* Course Tabs */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shrink-0">
                        <button
                          onClick={() => setActiveCourseTab("coursework")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            activeCourseTab === "coursework"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Assignments</span>
                        </button>
                        <button
                          onClick={() => setActiveCourseTab("announcements")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            activeCourseTab === "announcements"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>Announcements</span>
                        </button>
                        <button
                          onClick={() => setActiveCourseTab("roster")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            activeCourseTab === "roster"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Roster</span>
                        </button>
                      </div>
                    </div>

                    {/* Tab 1: Coursework / Assignments */}
                    {activeCourseTab === "coursework" && (
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Coursework & Drills ({courseWorkList.length})
                          </span>
                          <button
                            onClick={() => setShowCreateAssignmentForm(!showCreateAssignmentForm)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Issue Assignment</span>
                          </button>
                        </div>

                        {/* Create Assignment Form */}
                        {showCreateAssignmentForm && (
                          <form onSubmit={promptCreateAssignment} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-3 animate-fade-in text-xs shadow-sm">
                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-emerald-500" /> Issue Google Classroom Assignment
                              </span>
                              <button type="button" onClick={() => setShowCreateAssignmentForm(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Medical Presets */}
                            <div>
                              <label className="text-[10px] text-slate-500 block font-bold uppercase mb-1">Clinical Presets</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePresetAssignment("airway")}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg text-left truncate"
                                >
                                  🫁 Airway
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePresetAssignment("trauma")}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg text-left truncate"
                                >
                                  🚑 ATLS Survey
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePresetAssignment("pediatric")}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg text-left truncate"
                                >
                                  👶 PALS Dose
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePresetAssignment("ecg")}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-lg text-left truncate"
                                >
                                  📈 ECG STEMI
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Assignment Title</label>
                              <input
                                type="text"
                                required
                                value={assignmentTitle}
                                onChange={(e) => setAssignmentTitle(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Description & Guidelines</label>
                              <textarea
                                rows={3}
                                value={assignmentDesc}
                                onChange={(e) => setAssignmentDesc(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white resize-none"
                              />
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <div>
                                <label className="text-[10px] text-slate-500 block font-bold uppercase mb-0.5">Max Points</label>
                                <input
                                  type="number"
                                  value={assignmentPoints}
                                  onChange={(e) => setAssignmentPoints(Number(e.target.value))}
                                  className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={isExecuting}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Publish Assignment</span>
                              </button>
                            </div>
                          </form>
                        )}

                        {/* List Coursework */}
                        {isLoadingDetails ? (
                          <p className="text-xs text-slate-400 py-6 text-center font-mono">Loading Google Classroom coursework...</p>
                        ) : courseWorkList.length === 0 ? (
                          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-xs text-slate-400 space-y-1">
                            <p>No assignments created in this course yet.</p>
                            <p className="text-[11px] text-slate-500">Click "Issue Assignment" above to assign clinical drills to residents.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {courseWorkList.map((cw) => (
                              <div
                                key={cw.id}
                                className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-start justify-between gap-3 text-xs shadow-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-slate-900 dark:text-white">{cw.title}</h5>
                                    {cw.maxPoints && (
                                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono px-2 py-0.5 rounded font-bold">
                                        {cw.maxPoints} pts
                                      </span>
                                    )}
                                  </div>
                                  {cw.description && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{cw.description}</p>
                                  )}
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Published: {cw.creationTime ? new Date(cw.creationTime).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                                {cw.alternateLink && (
                                  <a
                                    href={cw.alternateLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors shrink-0"
                                    title="View in Google Classroom"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Announcements */}
                    {activeCourseTab === "announcements" && (
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Course Announcements ({announcementList.length})
                          </span>
                          <button
                            onClick={() => setShowCreateAnnouncementForm(!showCreateAnnouncementForm)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Post Notice</span>
                          </button>
                        </div>

                        {/* Create Announcement Form */}
                        {showCreateAnnouncementForm && (
                          <form onSubmit={promptCreateAnnouncement} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-3 animate-fade-in text-xs shadow-sm">
                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                              <span>Post Google Classroom Announcement</span>
                              <button type="button" onClick={() => setShowCreateAnnouncementForm(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div>
                              <textarea
                                rows={3}
                                required
                                value={announcementText}
                                onChange={(e) => setAnnouncementText(e.target.value)}
                                placeholder="Write announcement for residents & students..."
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white resize-none"
                              />
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                disabled={isExecuting}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                              >
                                <Megaphone className="w-3.5 h-3.5" />
                                <span>Broadcast Notice</span>
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Announcement Feed */}
                        {isLoadingDetails ? (
                          <p className="text-xs text-slate-400 py-6 text-center font-mono">Loading Google Classroom announcements...</p>
                        ) : announcementList.length === 0 ? (
                          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-xs text-slate-400 space-y-1">
                            <p>No announcements posted in this course yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {announcementList.map((ann) => (
                              <div
                                key={ann.id}
                                className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-1 shadow-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {ann.creationTime ? new Date(ann.creationTime).toLocaleString() : 'N/A'}
                                  </span>
                                  {ann.alternateLink && (
                                    <a
                                      href={ann.alternateLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 hover:underline text-[11px] font-semibold flex items-center gap-1"
                                    >
                                      <span>View Feed</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{ann.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Roster */}
                    {activeCourseTab === "roster" && (
                      <div className="space-y-3 flex-1">
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Class Roster ({studentList.length} Enrolled)
                        </span>

                        {isLoadingDetails ? (
                          <p className="text-xs text-slate-400 py-6 text-center font-mono">Loading class roster...</p>
                        ) : studentList.length === 0 ? (
                          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-xs text-slate-400 space-y-1">
                            <p>No students or residents enrolled in this course yet.</p>
                            <p className="text-[11px] text-slate-500">Share your Google Classroom course code or link with residents to join.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {studentList.map((st, idx) => (
                              <div
                                key={st.userId || idx}
                                className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-3 text-xs"
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center shrink-0">
                                  {st.profile?.name?.fullName?.[0] || 'S'}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{st.profile?.name?.fullName || 'Enrolled Resident'}</p>
                                  <p className="text-[11px] text-slate-500 font-mono">{st.profile?.emailAddress || st.userId}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-400">
                    <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Course Selected</p>
                    <p className="text-[11px] max-w-xs">Select a course from the left menu or click "New Course" to launch a Google Classroom residency module.</p>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Google Workspace OAuth Permission Model (Google Classroom API)</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Portal
          </button>
        </div>

      </div>

      {/* Mandatory User Confirmation Dialog for Workspace API Mutations */}
      {pendingAction && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">{pendingAction.title}</h4>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
              {pendingAction.details}
            </p>

            <p className="text-xs text-slate-500">
              This operation will modify data on your Google Classroom account with your explicit authorization.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = pendingAction;
                  setPendingAction(null);
                  await act.execute();
                }}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
