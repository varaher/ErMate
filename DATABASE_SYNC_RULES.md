# ErMate Dual-Database Synchronization & Data Ownership Architecture

ErMate employs a high-performance **Dual-Database Architecture** combining the real-time, offline-first capabilities of **Firebase Firestore** with the robust, relational analytics and auditing strengths of **Cloud SQL (PostgreSQL)**.

This document details the data ownership rules, synchronization patterns, and conflict prevention strategies used to keep both systems in pristine alignment.

---

## 1. Core Principles of Dual-Database Synchronization

1. **Firestore is the Real-time & Offline Core**:
   * It serves as the primary gateway for all user interaction.
   * UI components subscribe to collections via `onSnapshot` for instantaneous, reactive updates.
   * It handles transient offline states transparently in the browser.

2. **Cloud SQL (PostgreSQL) is the Relational Audit & Analytical Engine**:
   * It handles structured clinical reporting, shift handovers, learning metadata, and team-wide auditing.
   * Updates are synced as transactions using PostgreSQL upserts (`ON CONFLICT DO UPDATE`).

3. **Uni-directional Write Flow (Origin → Replica)**:
   * **Firestore is the Source of Truth** for operational data (Users, Cases, Handovers, Team Members).
   * **PostgreSQL is the Source of Truth** for analytical and contribution data (Learning Contributions).
   * Writes originating in Firestore are propagated to PostgreSQL immediately upon successful client-side confirmation.

---

## 2. Collection & Table Ownership Matrix

| Data Entity | Primary Database | Replication Target | Sync Flow | Ownership & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **User Profiles** (`users`) | **Firestore** | **Cloud SQL** (`users` table) | Client-driven `/api/sql/sync-user` | **Firestore Owns**. Profile edits are written to Firestore first. On success, the client pushes the profile payload to PostgreSQL. |
| **Clinical Cases** (`cases`) | **Firestore** | **Cloud SQL** (`cases` table) | Client-driven `/api/sql/cases` | **Firestore Owns**. Active case files, vitals, assessments, and status flags are managed in real-time in Firestore. Updates push-sync asynchronously. |
| **Shift Handovers** (`handovers`) | **Firestore** | **Cloud SQL** (`handovers` table) | Client-driven `/api/sql/handovers` | **Firestore Owns**. Structured clinical handovers are saved to Firestore, and then push-synced to PostgreSQL for audits. |
| **Team Members** (`team_members`) | **Firestore** | **Cloud SQL** (`team_members` table) | Client-driven `/api/sql/team-members` | **Firestore Owns**. Active hospital shifts, roles, and status fields are replicated upon profile change or roster actions. |
| **AI Learning / Clinical Contributions** (`contributions`) | **Cloud SQL** | None | Directly Written to Cloud SQL | **PostgreSQL Owns**. De-identified clinical insight contributions and voice model training metadata are stored directly in Cloud SQL for structured SQL queries. |

---

## 3. Conflict Prevention Strategies

To guarantee data integrity and prevent race conditions or sync conflicts between Firestore and Cloud SQL, ErMate enforces three structural safeguards:

### 3.1. Timestamp-Based Optimistic Locking
* Every record includes standard metadata: `createdAt` (ISO string) and `updatedAt` (ISO string).
* During SQL push-sync operations, the backend compares incoming payloads against the existing target record.
* If `payload.updatedAt` is older than or equal to the database's existing `updatedAt` timestamp, the update is ignored. This prevents older offline-cached syncs from overwriting fresh online modifications.

### 3.2. Idempotent PostgreSQL Upserts (`ON CONFLICT`)
* All sync API endpoints (e.g., `/api/sql/sync-user`, `/api/sql/cases`) utilize Drizzle ORM's relational insert capabilities with `onConflictDoUpdate`.
* Payloads are matched by unique primary keys (e.g., User `uid`, Case `id`).
* If a sync payload is sent multiple times due to network retries, the database updates the existing record instead of creating duplicates, ensuring complete idempotency.

### 3.3. Isolation of Local vs. Shared Workflows
* Changes to private, user-specific data are isolated to the specific user's Firestore document before being merged.
* Inter-user synchronization for collaborative features (such as Case sheets or Shift rosters) relies entirely on server-sent snapshots, guaranteeing that all users are editing the same source before replicating to Cloud SQL.
