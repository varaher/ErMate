import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

// In-memory token cache (never stored in localStorage or sessionStorage)
let cachedClassroomToken: string | null = null;

export function getCachedClassroomToken(): string | null {
  return cachedClassroomToken;
}

export function clearCachedClassroomToken(): void {
  cachedClassroomToken = null;
}

/**
 * Prompt user to sign in or authorize Google Classroom scopes via Firebase GoogleAuthProvider.
 */
export async function authenticateGoogleClassroom(): Promise<string> {
  if (cachedClassroomToken) {
    return cachedClassroomToken;
  }

  const classroomProvider = new GoogleAuthProvider();
  classroomProvider.setCustomParameters({ prompt: "select_account" });
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.courses");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.coursework.me");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.coursework.students");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.announcements");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.rosters");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.topics");
  classroomProvider.addScope("https://www.googleapis.com/auth/classroom.courseworkmaterials");

  try {
    const result = await signInWithPopup(auth, classroomProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Could not retrieve Google Classroom access token from login result.");
    }
    cachedClassroomToken = credential.accessToken;
    return cachedClassroomToken;
  } catch (err: any) {
    console.error("[Google Classroom Auth Error]:", err);
    throw new Error(err?.message || "Failed to authenticate with Google Classroom.");
  }
}

export interface ClassroomCourse {
  id?: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  alternateLink?: string;
  courseState?: string;
}

export interface ClassroomCourseWork {
  id?: string;
  courseId: string;
  title: string;
  description?: string;
  materials?: any[];
  state?: string;
  alternateLink?: string;
  creationTime?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours: number; minutes: number };
  maxPoints?: number;
  workType?: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" | "MULTIPLE_CHOICE_QUESTION";
}

export interface ClassroomAnnouncement {
  id?: string;
  courseId: string;
  text: string;
  state?: string;
  alternateLink?: string;
  creationTime?: string;
}

/**
 * List all courses the user teaches or is enrolled in
 */
export async function listClassroomCourses(
  accessToken: string
): Promise<{ success: boolean; courses?: ClassroomCourse[]; error?: string }> {
  try {
    const response = await fetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearCachedClassroomToken();
      }
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, courses: data.courses || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to connect to Google Classroom API." };
  }
}

/**
 * Create a new Google Classroom course (Requires User Confirmation)
 */
export async function createClassroomCourse(
  accessToken: string,
  course: ClassroomCourse
): Promise<{ success: boolean; course?: ClassroomCourse; error?: string }> {
  try {
    const payload = {
      name: course.name,
      section: course.section || "Emergency Medicine",
      descriptionHeading: course.descriptionHeading || "Clinical Training & Residency Education",
      description: course.description || "Emergency Medicine training module managed via ErMate Clinical System.",
      room: course.room || "ER Seminar Room A",
      ownerId: "me",
      courseState: "ACTIVE",
    };

    const response = await fetch("https://classroom.googleapis.com/v1/courses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const created = await response.json();
    return { success: true, course: created };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create course." };
  }
}

/**
 * List course work / assignments for a specific course
 */
export async function listCourseWork(
  accessToken: string,
  courseId: string
): Promise<{ success: boolean; courseWork?: ClassroomCourseWork[]; error?: string }> {
  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, courseWork: data.courseWork || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch coursework." };
  }
}

/**
 * Create a new CourseWork / Assignment (Requires User Confirmation)
 */
export async function createCourseWork(
  accessToken: string,
  courseId: string,
  item: {
    title: string;
    description?: string;
    maxPoints?: number;
    dueDate?: { year: number; month: number; day: number };
    dueTime?: { hours: number; minutes: number };
    workType?: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" | "MULTIPLE_CHOICE_QUESTION";
  }
): Promise<{ success: boolean; courseWork?: ClassroomCourseWork; error?: string }> {
  try {
    const payload: any = {
      title: item.title,
      description: item.description || "Clinical Education Coursework.",
      maxPoints: item.maxPoints || 100,
      workType: item.workType || "ASSIGNMENT",
      state: "PUBLISHED",
    };

    if (item.dueDate) {
      payload.dueDate = item.dueDate;
    }
    if (item.dueTime) {
      payload.dueTime = item.dueTime;
    }

    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const created = await response.json();
    return { success: true, courseWork: created };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create assignment." };
  }
}

/**
 * List announcements in a course
 */
export async function listAnnouncements(
  accessToken: string,
  courseId: string
): Promise<{ success: boolean; announcements?: ClassroomAnnouncement[]; error?: string }> {
  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, announcements: data.announcements || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch announcements." };
  }
}

/**
 * Create a new Announcement (Requires User Confirmation)
 */
export async function createAnnouncement(
  accessToken: string,
  courseId: string,
  text: string
): Promise<{ success: boolean; announcement?: ClassroomAnnouncement; error?: string }> {
  try {
    const payload = {
      text,
      state: "PUBLISHED",
    };

    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const created = await response.json();
    return { success: true, announcement: created };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to post announcement." };
  }
}

/**
 * List course students roster
 */
export async function listCourseStudents(
  accessToken: string,
  courseId: string
): Promise<{ success: boolean; students?: any[]; error?: string }> {
  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, students: data.students || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch students roster." };
  }
}

/**
 * List student submissions for a specific coursework item
 */
export async function listStudentSubmissions(
  accessToken: string,
  courseId: string,
  courseWorkId: string
): Promise<{ success: boolean; submissions?: any[]; error?: string }> {
  try {
    const response = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) clearCachedClassroomToken();
      const errJson = await response.json().catch(() => ({}));
      return { success: false, error: errJson?.error?.message || `API error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, submissions: data.studentSubmissions || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch student submissions." };
  }
}
