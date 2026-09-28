/**
 * scripts/backfill-membership-verified.cjs
 * 
 * Production Membership Verification Audit & Migration Tool
 * 
 * CRITICAL SAFETY RULES:
 * 1. DEFAULT MODE IS STRICTLY DRY-RUN (no database writes).
 * 2. DOES NOT SUPPORT --apply-all (strictly blocked).
 * 3. In --apply mode, an explicit reviewed approval file via --approved-file=<path.json> is MANDATORY.
 *    (Passing --apply without an approved file or with --apply-all hard fails with exit code 1).
 * 4. Resolves legacy mem-* email to Firebase Auth UID via getAuth().getUserByEmail().
 * 5. Atomic canonical team_members/{uid} creation with migratedTo marker on legacy doc using transactions.
 * 6. Never invents hospitalId (unmapped hospital names output UNMAPPED_REQUIRES_HUMAN_REVIEW).
 * 7. Inactive legacy records (inactive, rejected, pending, pending_approval) are NEVER migrated active (HARD FAIL / HOLD).
 * 8. Approval file entries require authority fields (legacyDocId, uid, email, hospitalId, hospitalName, legacyHospitalNames, role).
 * 9. Race-safe: Transaction checks team_members/{uid} existence before writing and aborts on conflict.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Load database configuration
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
let firebaseConfig = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[MIGRATION] Could not read firebase-applet-config.json:', e.message);
  process.exit(1);
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || firebaseConfig.projectId || 'ermate-e8f01';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || (process.env.FIRESTORE_EMULATOR_HOST ? '(default)' : (firebaseConfig.firestoreDatabaseId || 'ai-studio-ermate-c85078ba-126c-43fd-b799-a4aa8b82bf03'));

const app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0];
const db = FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
  ? getFirestore(app, FIRESTORE_DATABASE_ID)
  : getFirestore(app);
const auth = getAuth(app);

// Parse CLI flags
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const approvedFileArg = args.find(a => a.startsWith('--approved-file='));

if (args.includes('--apply-all')) {
  console.error('\n[FATAL] Flag --apply-all is strictly forbidden by ErMate security policy.');
  console.error('All membership verification backfills require an explicit, reviewed whitelist of approved entries via --approved-file.\n');
  process.exit(1);
}

const approvedEntriesByLegacyId = new Map(); // key: legacyDocId -> approved object

if (isApply) {
  if (!approvedFileArg) {
    console.error('\n[FATAL] Apply mode requires --approved-file=<path.json>.');
    console.error('Refusing to apply changes without explicit reviewed approval file.\n');
    process.exit(1);
  }

  const filePath = approvedFileArg.split('=')[1].trim();
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
    for (const item of list) {
      if (item && item.legacyDocId) {
        approvedEntriesByLegacyId.set(item.legacyDocId, item);
      }
    }
  } catch (err) {
    console.error(`[FATAL] Could not read or parse approved list file "${filePath}":`, err.message);
    process.exit(1);
  }
}

const VALID_LEGACY_ACTIVE_STATUSES = ['active', 'Active (Joined)'];
const EXACT_ADMIN_ROLES = ['hod', 'hod / department lead', 'hod / shift lead'];
const ALLOWED_CLINICAL_ROLES = [
  ...EXACT_ADMIN_ROLES,
  'resident', 'consultant', 'senior consultant', 'em resident', 'em intern',
  'em_physician', 'nurse', 'doctor', 'fellow', 'medical_officer', 'scribe specialist'
];

// ── Legacy Hospital Distinct Value Inventory ───────────────────
async function runLegacyHospitalInventory() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' LEGACY HOSPITAL NAME INVENTORY (DRY-RUN)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const collectionsToInspect = [
    { name: 'cases', field: 'hospital', pathDesc: 'cases (legacy cases without workspaceType)' },
    { name: 'handovers', field: 'hospital', pathDesc: 'handovers' },
    { name: 'quick_paste_patients', field: 'hospital', pathDesc: 'quick_paste_patients' },
    { name: 'hospital_shifts', field: '__doc_id__', pathDesc: 'hospital_shifts/{hospitalId}' },
    { name: 'hospital_subscriptions', field: '__doc_id__', pathDesc: 'hospital_subscriptions/{hospitalId}' }
  ];

  for (const target of collectionsToInspect) {
    try {
      const snap = await db.collection(target.name).get();
      const distinctMap = new Map();

      for (const doc of snap.docs) {
        const data = doc.data();
        let val = null;
        if (target.field === '__doc_id__') {
          val = doc.id;
        } else {
          // If cases, only inspect legacy cases
          if (target.name === 'cases' && data.workspaceType) {
            continue;
          }
          val = data[target.field] || '(empty/unspecified)';
        }

        const count = distinctMap.get(val) || 0;
        distinctMap.set(val, count + 1);
      }

      console.log(`\nPath: ${target.pathDesc}`);
      console.log(`Total inspected documents: ${snap.size}`);
      if (distinctMap.size === 0) {
        console.log('  No matching records found.');
      } else {
        console.log('  Distinct Hospital Values:');
        for (const [hospitalVal, count] of distinctMap.entries()) {
          console.log(`    - "${hospitalVal}": ${count} document(s)`);
        }
      }
    } catch (err) {
      console.warn(`Could not inventory ${target.name}:`, err.message);
    }
  }

  // Check departments/{deptId}/cases/{caseId}
  try {
    const deptsSnap = await db.collection('departments').get();
    console.log(`\nPath: departments/{deptId}/cases`);
    console.log(`Total department documents: ${deptsSnap.size}`);
    const deptHospitalMap = new Map();

    for (const deptDoc of deptsSnap.docs) {
      const casesSnap = await deptDoc.ref.collection('cases').get();
      for (const cDoc of casesSnap.docs) {
        const cData = cDoc.data();
        const hospVal = cData.hospital || deptDoc.id || '(unspecified)';
        const count = deptHospitalMap.get(hospVal) || 0;
        deptHospitalMap.set(hospVal, count + 1);
      }
    }

    if (deptHospitalMap.size === 0) {
      console.log('  No department cases found.');
    } else {
      console.log('  Distinct Hospital Values in departments/*/cases:');
      for (const [hospVal, count] of deptHospitalMap.entries()) {
        console.log(`    - "${hospVal}": ${count} document(s)`);
      }
    }
  } catch (err) {
    console.warn('Could not inventory departments/*/cases:', err.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ── Main Migration Inventory & Execution ────────────────────────
async function runInventoryAndMigration() {
  console.log('========================================================================');
  console.log(' ErMate — team_members Root-of-Trust Membership Verification Tool');
  console.log(` Mode: ${isApply ? 'APPLY (EXPLICIT REVIEWED INPUT ONLY)' : 'DRY-RUN (INVENTORY ONLY — NO WRITES)'}`);
  console.log(` Target Firestore DB: ${FIRESTORE_DATABASE_ID}`);
  console.log(` Project: ${PROJECT_ID}`);
  if (isApply) {
    console.log(` Approved Reviewed Entries: ${approvedEntriesByLegacyId.size}`);
  }
  console.log('========================================================================\n');

  // Step 1: Run Hospital Inventory
  await runLegacyHospitalInventory();

  // Step 2: Evaluate team_members
  const snapshot = await db.collection('team_members').get();
  console.log(`Found ${snapshot.size} team_members records in Firestore.\n`);

  const summary = {
    total: snapshot.size,
    alreadyVerified: 0,
    inviteCorroboratedNeedsReview: 0,
    needsReview: 0,
    identityUnresolved: 0,
    conflict: 0,
    inactive: 0,
    invalid: 0,
    migratedToCanonical: 0,
    updatedExisting: 0,
    hardFailed: 0
  };

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const docId = docSnap.id;
    const isLegacyDoc = docId.startsWith('mem-') || !data.uid;
    const email = (data.email || '').toLowerCase().trim();
    const legacyRole = data.role || 'Unspecified';
    const legacyStatus = data.status || 'active';
    const legacyHospital = data.hospital || data.hospitalName || '';
    const inviteId = data.inviteId || null;
    const currentVerified = data.membershipVerified === true;

    let resolvedUid = data.uid || (!docId.startsWith('mem-') ? docId : null);
    let identityResolutionStatus = 'RESOLVED';

    // 1. Resolve UID via Firebase Auth for legacy mem-* docs
    if (!resolvedUid && email && process.env.MOCK_AUTH_USERS) {
      try {
        const mockMap = JSON.parse(process.env.MOCK_AUTH_USERS);
        if (mockMap[email.toLowerCase()]) {
          resolvedUid = mockMap[email.toLowerCase()];
        }
      } catch (e) {}
    }

    if (!resolvedUid && email) {
      try {
        const userRecord = await auth.getUserByEmail(email);
        resolvedUid = userRecord.uid;
      } catch (authErr) {
        identityResolutionStatus = 'IDENTITY_UNRESOLVED';
      }
    } else if (!resolvedUid && !email) {
      identityResolutionStatus = 'IDENTITY_UNRESOLVED';
    }

    // 2. Check if canonical doc already exists
    let canonicalDocExists = false;
    if (resolvedUid) {
      try {
        const existingCanonicalSnap = await db.collection('team_members').doc(resolvedUid).get();
        canonicalDocExists = existingCanonicalSnap.exists;
      } catch (e) {
        // ignore
      }
    }

    let classification = 'NEEDS REVIEW';
    let proposedAction = 'MANUAL_HOD_APPROVAL_REQUIRED';
    let provenanceNote = '';
    let proposedRole = 'resident'; // NEVER blindly copy HOD/owner from legacy doc
    
    // Never invent hospitalId from free text (Rule 4)
    let proposedHospitalId = data.hospitalId || 'UNMAPPED_REQUIRES_HUMAN_REVIEW';
    let proposedHospitalName = data.hospitalName || legacyHospital || 'UNMAPPED_REQUIRES_HUMAN_REVIEW';
    let proposedLegacyNames = legacyHospital ? [legacyHospital] : [];

    const isCurrentlyActive = VALID_LEGACY_ACTIVE_STATUSES.includes(legacyStatus);

    // Classification Decision Tree
    if (!isCurrentlyActive) {
      classification = 'INACTIVE';
      proposedAction = 'HOLD_NO_MIGRATE_INACTIVE';
      provenanceNote = `Legacy status is '${legacyStatus}'. Inactive legacy members must NEVER be migrated to active.`;
      summary.inactive++;
    } else if (identityResolutionStatus === 'IDENTITY_UNRESOLVED') {
      classification = 'IDENTITY_UNRESOLVED';
      proposedAction = 'HOLD_NO_MIGRATE';
      provenanceNote = `Could not resolve email '${email}' to an authenticated Firebase Auth UID.`;
      summary.identityUnresolved++;
    } else if (currentVerified) {
      classification = 'ALREADY VERIFIED';
      proposedAction = 'NO_ACTION';
      provenanceNote = 'Document already contains membershipVerified: true.';
      summary.alreadyVerified++;
    } else if (isLegacyDoc && canonicalDocExists && docId !== resolvedUid) {
      classification = 'CONFLICT';
      proposedAction = 'HOLD_DO_NOT_OVERWRITE';
      provenanceNote = `Canonical document team_members/${resolvedUid} ALREADY exists. Refusing to overwrite.`;
      summary.conflict++;
    } else if (!data.hospitalId && !legacyHospital) {
      classification = 'INVALID / INCONSISTENT';
      proposedAction = 'INVESTIGATE_OR_DEACTIVATE';
      provenanceNote = 'Missing both hospitalId and hospital.';
      summary.invalid++;
    } else if (inviteId) {
      try {
        const inviteSnap = await db.collection('teamInvites').doc(inviteId).get();
        if (!inviteSnap.exists) {
          classification = 'NEEDS REVIEW';
          proposedAction = 'MANUAL_HOD_APPROVAL_REQUIRED';
          provenanceNote = `Referenced teamInvites '${inviteId}' does NOT exist.`;
          summary.needsReview++;
        } else {
          const invite = inviteSnap.data();
          if (invite.revoked === true) {
            classification = 'INVALID / INCONSISTENT';
            proposedAction = 'REJECT_REVOKED_INVITE';
            provenanceNote = `Referenced invite '${inviteId}' was REVOKED.`;
            summary.invalid++;
          } else {
            classification = 'INVITE_CORROBORATED_NEEDS_REVIEW';
            proposedAction = 'REQUIRE_EXPLICIT_HUMAN_APPROVAL';
            provenanceNote = `Referenced invite '${inviteId}' exists. Explicit human approval via approval file is still required.`;
            summary.inviteCorroboratedNeedsReview++;
          }
        }
      } catch (err) {
        classification = 'NEEDS REVIEW';
        proposedAction = 'MANUAL_HOD_APPROVAL_REQUIRED';
        provenanceNote = `Error cross-checking invite '${inviteId}': ${err.message}`;
        summary.needsReview++;
      }
    } else {
      classification = 'NEEDS REVIEW';
      proposedAction = 'MANUAL_HOD_APPROVAL_REQUIRED';
      provenanceNote = 'Legacy record with no cross-checkable backend invite reference.';
      summary.needsReview++;
    }

    console.log(`[RECORD] ${docId}`);
    console.log(`  - email: "${email}"`);
    console.log(`  - resolvedUid: ${resolvedUid || '(none)'}`);
    console.log(`  - existing team_members/{uid}?: ${canonicalDocExists ? 'YES' : 'NO'}`);
    console.log(`  - legacy status: "${legacyStatus}"`);
    console.log(`  - legacy role: "${legacyRole}"`);
    console.log(`  - legacy hospital: "${legacyHospital}"`);
    console.log(`  - canonicalHospitalId: "${proposedHospitalId}"`);
    console.log(`  - canonicalHospitalName: "${proposedHospitalName}"`);
    console.log(`  - proposed role: "${proposedRole}" (safe clinician default; never auto-elevated to HOD)`);
    console.log(`  - classification: [${classification}]`);
    console.log(`  - migration decision: ${proposedAction}`);
    console.log(`  - notes: ${provenanceNote}`);

    // If apply mode is active:
    if (isApply) {
      const approved = approvedEntriesByLegacyId.get(docId);

      if (approved) {
        // Strict Authority Fields Validation (Rule 5)
        const requiredFields = ['legacyDocId', 'uid', 'email', 'hospitalId', 'hospitalName', 'legacyHospitalNames', 'role'];
        const missingFields = requiredFields.filter(f => approved[f] === undefined || approved[f] === null || approved[f] === '');
        
        let validationError = null;
        if (missingFields.length > 0) {
          validationError = `Missing required authority field(s): ${missingFields.join(', ')}`;
        } else if (approved.uid !== resolvedUid) {
          validationError = `UID mismatch: approved.uid "${approved.uid}" !== resolvedUid "${resolvedUid}"`;
        } else if (approved.email.toLowerCase().trim() !== email) {
          validationError = `Email mismatch: approved.email "${approved.email}" !== record email "${email}"`;
        } else if (approved.legacyDocId !== docId) {
          validationError = `legacyDocId mismatch: approved.legacyDocId "${approved.legacyDocId}" !== docId "${docId}"`;
        } else if (!Array.isArray(approved.legacyHospitalNames)) {
          validationError = `legacyHospitalNames must be an array`;
        } else if (!ALLOWED_CLINICAL_ROLES.includes(approved.role.trim().toLowerCase())) {
          validationError = `Role "${approved.role}" is not in the allowed roles list`;
        } else if (!isCurrentlyActive) {
          // Rule 6: Inactive legacy members must NEVER be migrated active
          validationError = `Record status is "${legacyStatus}" (not active). Inactive legacy members must NEVER be migrated active.`;
        }

        if (validationError) {
          console.error(`  -> [HARD FAIL] ${validationError}. NO WRITE PERFORMED.`);
          summary.hardFailed++;
          continue;
        }

        // Rule 7: Race-safe transaction
        try {
          await db.runTransaction(async (tx) => {
            const canonicalRef = db.collection('team_members').doc(resolvedUid);
            const canonicalSnap = await tx.get(canonicalRef);

            if (canonicalSnap.exists && docId !== resolvedUid) {
              throw new Error(`CONFLICT: Canonical team_members/${resolvedUid} already exists. Aborting transaction.`);
            }

            const legacyRef = db.collection('team_members').doc(docId);
            const legacySnap = await tx.get(legacyRef);

            if (!legacySnap.exists) {
              throw new Error(`Legacy document ${docId} does not exist.`);
            }

            // Create canonical team_members/{uid}
            tx.set(canonicalRef, {
              id: resolvedUid,
              uid: resolvedUid,
              email: approved.email.toLowerCase().trim(),
              name: data.name || email,
              role: approved.role,
              status: 'active',
              hospitalId: approved.hospitalId,
              hospitalName: approved.hospitalName,
              hospital: approved.hospitalName,
              legacyHospitalNames: approved.legacyHospitalNames,
              membershipVerified: true,
              migratedFrom: docId,
              membershipVerifiedBy: 'admin-migration-approval-file',
              membershipVerifiedAt: new Date().toISOString(),
              migratedAt: new Date().toISOString()
            });

            // Mark old legacy document migratedTo ONLY if distinct
            if (docId !== resolvedUid) {
              tx.update(legacyRef, {
                migratedTo: resolvedUid,
                migratedAt: new Date().toISOString()
              });
            }
          });

          console.log(`  -> [SUCCESS] Atomically created canonical team_members/${resolvedUid} and stamped ${docId}.`);
          summary.migratedToCanonical++;
        } catch (txErr) {
          console.error(`  -> [TRANSACTION ABORTED] ${txErr.message}`);
          summary.hardFailed++;
        }
      } else {
        console.log(`  -> [HELD] Record ${docId} is not in the approved approval file. No write performed.`);
      }
    }

    console.log('');
  }

  console.log('========================================================================');
  console.log(' MIGRATION INVENTORY SUMMARY');
  console.log('========================================================================');
  console.log(` Total team_members evaluated          : ${summary.total}`);
  console.log(` Already Verified                      : ${summary.alreadyVerified}`);
  console.log(` Inactive (Never Migrated Active)      : ${summary.inactive}`);
  console.log(` Invite Corroborated (Needs Review)    : ${summary.inviteCorroboratedNeedsReview}`);
  console.log(` Needs Review (Manual HOD Required)    : ${summary.needsReview}`);
  console.log(` Identity Unresolved (Cannot Migrate)  : ${summary.identityUnresolved}`);
  console.log(` Conflict (Canonical UID Exists)       : ${summary.conflict}`);
  console.log(` Invalid / Inconsistent                : ${summary.invalid}`);
  if (isApply) {
    console.log(` Migrated to Canonical UID docs        : ${summary.migratedToCanonical}`);
    console.log(` Hard Failed / Aborted Records         : ${summary.hardFailed}`);
  }
  console.log('========================================================================\n');
}

runInventoryAndMigration().catch((err) => {
  console.error('[FATAL MIGRATION ERROR]', err);
  process.exit(1);
});
