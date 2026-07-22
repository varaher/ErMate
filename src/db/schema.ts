import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

// Users table (linked to Firebase Auth UID)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role"),
  hospital: text("hospital"),
  aiCredits: integer("ai_credits").default(350),
  streak: integer("streak").default(0),
  subscriptionTier: text("subscription_tier").default("Free Standard"),
  seededCases: boolean("seeded_cases").default(false),
  hasConsentedToLearning: boolean("has_consented_to_learning"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Clinical Cases table
export const cases = pgTable("cases", {
  id: text("id").primaryKey(), // e.g. "C-9041"
  patient: jsonb("patient").notNull(), // Object with demographics
  vitals: jsonb("vitals").notNull(), // Object with bp, hr, spo2, etc.
  sampleHistory: jsonb("sample_history"), // Object with SAMPLE details
  primaryAssessment: jsonb("primary_assessment"), // Object with ABCDE
  secondaryAssessment: text("secondary_assessment"),
  investigations: jsonb("investigations"), // Array of investigations
  treatments: jsonb("treatments"), // Array of treatment objects
  progressNotes: text("progress_notes"),
  dischargeInfo: jsonb("discharge_info"), // Object with discharge details
  differentials: jsonb("differentials"), // Array of differential objects
  isPediatric: boolean("is_pediatric").default(false),
  status: text("status").notNull(), // "Triage", "Active", "Discharged"
  savedTime: text("saved_time"),
  timeSpentMin: integer("time_spent_min").default(0),
  doctorEmail: text("doctor_email"),
  doctorName: text("doctor_name"),
  hospital: text("hospital"), // To filter by hospital
  createdAt: timestamp("created_at").defaultNow(),
});

// Shift Handovers table
export const handovers = pgTable("handovers", {
  id: text("id").primaryKey(),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  timestamp: text("timestamp").notNull(),
  caseCount: integer("case_count").notNull(),
  patientsText: text("patients_text").notNull(),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedTime: text("acknowledged_time"),
  hospital: text("hospital"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Team Members table
export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(), // mem-[emailClean]
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(), // "Pending Invite", "Active (Joined)"
  shift: text("shift").notNull(),
  hospital: text("hospital").notNull(),
  assignedBy: text("assigned_by"),
  updatedAt: text("updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Hospital Subscriptions table
export const hospitalSubscriptions = pgTable("hospital_subscriptions", {
  id: text("id").primaryKey(), // hospital slug or ID
  hospital: text("hospital").notNull(),
  subscriptionTier: text("subscription_tier").notNull(),
  active: boolean("active").default(true).notNull(),
  updatedAt: text("updated_at"),
});

// Suggested Clinical Contributions (Mnemonics & Guidelines) table
export const contributions = pgTable("contributions", {
  id: text("id").primaryKey(), // e.g. "contrib_172019283726"
  title: text("title").notNull(),
  mnemonic: text("mnemonic").notNull(),
  category: text("category").notNull(),
  breakdown: text("breakdown").notNull(),
  explanation: text("explanation"),
  status: text("status").default("pending").notNull(), // "pending", "approved"
  submittedBy: text("submitted_by").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  createdAt: text("created_at").notNull(), // Store ISO string as in original Firestore entries
});
