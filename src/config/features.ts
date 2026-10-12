/**
 * src/config/features.ts
 *
 * Individual V1 feature switches.
 *
 * teamsForIndividuals = false:
 *   - Clinicians who are NOT already verified hospital-team members cannot open
 *     Team / Roster screens or create a team workspace from onboarding.
 *   - Existing verified team members keep their Team screens (nothing is deleted).
 *   - The Clinician Directory (reads every user profile) is hidden for everyone.
 *
 * This is a visibility switch only. Data access is enforced by firestore.rules.
 * Flip to true to bring the team features back. No code is removed.
 */
export const FEATURES = {
  teamsForIndividuals: false,
} as const;
