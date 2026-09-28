const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');

async function runAudit() {
  const rulesPath = path.resolve(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'ermate-audit-p',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  console.log('[AUDIT] Test environment initialized for privilege escalation audit');

  // Identifiers
  const UID_HOSP_X = 'user_hosp_x';
  const UID_ATTACKER_Y = 'user_attacker_y';
  const UID_MEMBER_Y_2 = 'user_member_y_2';
  const UID_SOLO = 'user_solo_practitioner';
  const UID_RAJAGIRI_LOWER = 'user_rajagiri_lower';
  const UID_RAJAGIRI_TRAILING = 'user_rajagiri_trailing';

  // Seed baseline data
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Hospital X Context
    await db.collection('users').doc(UID_HOSP_X).set({
      name: 'Dr. Hospital X Primary',
      email: 'primary@hospital-x.com',
      role: 'EM Resident',
      hospital: 'Hospital X',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });

    await db.collection('team_members').doc(UID_HOSP_X).set({
      id: UID_HOSP_X,
      name: 'Dr. Hospital X Primary',
      email: 'primary@hospital-x.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Morning',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
    });

    // 1. One LEGACY case belonging to Hospital X
    await db.collection('cases').doc('case_legacy_x').set({
      patientName: 'Patient Legacy X',
      hospital: 'Hospital X',
      chiefComplaints: 'Chest pain',
    });

    // 2. One ownership-aware hospital ClinicalCase with hospitalId = hosp_x_id
    await db.collection('cases').doc('case_aware_x').set({
      patientName: 'Patient Aware X',
      workspaceType: 'hospital',
      hospitalId: 'hosp_x_id',
      createdByUid: UID_HOSP_X,
      chiefComplaints: 'Acute MI',
    });

    // 2b. Second ownership-aware hospital case for P8
    await db.collection('cases').doc('case_aware_x_2').set({
      patientName: 'Patient Aware X Secondary',
      workspaceType: 'hospital',
      hospitalId: 'hosp_x_id',
      createdByUid: UID_HOSP_X,
      chiefComplaints: 'Ischemic Stroke',
    });

    // 3. One handover belonging to Hospital X
    await db.collection('handovers').doc('handover_x').set({
      hospital: 'Hospital X',
      shiftDate: '2026-09-24',
      summary: 'Emergency Ward Shift Handover X',
    });

    // 4. Department cases for Hospital X
    // The real app uses hospitalSlug: userHospitalLower.replace(/[^a-z0-9]/g, "-").replace(/^-+|-+$/g, "")
    // which yields "hospital-x".
    await db.collection('departments').doc('hospital-x').collection('cases').doc('case_dept_slug_x').set({
      patientName: 'Dept Case Slug X',
      hospital: 'Hospital X',
    });
    // Also test raw name if myHospital() was "Hospital X"
    await db.collection('departments').doc('Hospital X').collection('cases').doc('case_dept_raw_x').set({
      patientName: 'Dept Case Raw X',
      hospital: 'Hospital X',
    });

    // 5. One quick_paste_patients record associated with Hospital X
    await db.collection('quick_paste_patients').doc('paste_x').set({
      hospital: 'Hospital X',
      patientName: 'Quick Paste Patient X',
      notes: 'Trauma handover notes',
    });

    // 6. One team invite token for Hospital X
    await db.collection('teamInvites').doc('invite_token_x_123').set({
      id: 'invite_token_x_123',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
      role: 'resident',
      createdByUid: UID_HOSP_X,
      createdAt: '2026-09-24T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      maxUses: 10,
      usedCount: 0,
      invitedEmail: 'target@example.com',
      revoked: false,
    });

    // Hospital Y Context (Attacker & Colleague)
    await db.collection('users').doc(UID_ATTACKER_Y).set({
      name: 'Dr. Attacker Y',
      email: 'attacker@hospital-y.com',
      role: 'EM Resident',
      hospital: 'Hospital Y',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });

    await db.collection('team_members').doc(UID_ATTACKER_Y).set({
      id: UID_ATTACKER_Y,
      name: 'Dr. Attacker Y',
      email: 'attacker@hospital-y.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Morning',
      hospital: 'Hospital Y',
      hospitalId: 'hosp_y_id',
    });

    await db.collection('team_members').doc(UID_MEMBER_Y_2).set({
      id: UID_MEMBER_Y_2,
      name: 'Dr. Colleague Inactive Y',
      email: 'colleague@hospital-y.com',
      role: 'EM Resident',
      status: 'inactive',
      shift: 'Off',
      hospital: 'Hospital Y',
      hospitalId: 'hosp_y_id',
    });

    // P12 Seed Context: Rajagiri Hospital casing and trailing space differences
    // Case 1: user profile has "Rajagiri Hospital", team_member has "rajagiri hospital"
    await db.collection('users').doc(UID_RAJAGIRI_LOWER).set({
      name: 'Dr. Lower Case Test',
      email: 'lower@rajagiri.com',
      role: 'EM Resident',
      hospital: 'Rajagiri Hospital',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_RAJAGIRI_LOWER).set({
      id: UID_RAJAGIRI_LOWER,
      name: 'Dr. Lower Case Test',
      email: 'lower@rajagiri.com',
      role: 'EM Resident',
      status: 'active',
      membershipVerified: true,
      shift: 'morning',
      hospital: 'rajagiri hospital',
      hospitalId: 'rajagiri_id',
    });

    // Case 2: user profile has "Rajagiri Hospital", team_member has "Rajagiri Hospital " (trailing space)
    await db.collection('users').doc(UID_RAJAGIRI_TRAILING).set({
      name: 'Dr. Trailing Space Test',
      email: 'trailing@rajagiri.com',
      role: 'EM Resident',
      hospital: 'Rajagiri Hospital',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_RAJAGIRI_TRAILING).set({
      id: UID_RAJAGIRI_TRAILING,
      name: 'Dr. Trailing Space Test',
      email: 'trailing@rajagiri.com',
      role: 'EM Resident',
      status: 'active',
      membershipVerified: true,
      shift: 'morning',
      hospital: 'Rajagiri Hospital ',
      hospitalId: 'rajagiri_id',
    });
  });

  console.log('[AUDIT] Baseline seed data created');

  async function observe(label, fn) {
    try {
      await fn();
      console.log(`[OBSERVED] ${label}: ALLOW`);
      return 'ALLOW';
    } catch (err) {
      console.log(`[OBSERVED] ${label}: DENY`);
      return 'DENY';
    }
  }

  // ==========================================
  // P1 — SELF-EDIT PROFILE HOSPITAL
  // Attacker updates users/{attackerUid}.hospital to "Hospital X"
  // ==========================================
  const ctxAttacker = testEnv.authenticatedContext(UID_ATTACKER_Y);
  await observe('P1', async () => {
    await ctxAttacker.firestore().collection('users').doc(UID_ATTACKER_Y).update({
      hospital: 'Hospital X',
    });
  });

  // ==========================================
  // P2 — LEGACY CASE ACCESS AFTER P1
  // Attacker attempts to read Hospital X's LEGACY case
  // ==========================================
  await observe('P2', async () => {
    await ctxAttacker.firestore().collection('cases').doc('case_legacy_x').get();
  });

  // ==========================================
  // P3 — HANDOVER ACCESS AFTER P1
  // Attacker attempts to read Hospital X's handover
  // ==========================================
  await observe('P3', async () => {
    await ctxAttacker.firestore().collection('handovers').doc('handover_x').get();
  });

  // ==========================================
  // P4 — DEPARTMENT CASE COPY AFTER P1
  // Attacker attempts to read departments/<deptId>/cases/{caseId}
  // We test both:
  // P4-slug: departments/hospital-x/cases/case_dept_slug_x
  // P4-raw: departments/Hospital X/cases/case_dept_raw_x
  // ==========================================
  await observe('P4', async () => {
    // Current rule evaluates: myHospital() == deptId
    // Since attacker profile now has hospital: "Hospital X",
    // myHospital() is "Hospital X".
    // We test accessing departments/"Hospital X"/cases/case_dept_raw_x
    await ctxAttacker.firestore().collection('departments').doc('Hospital X').collection('cases').doc('case_dept_raw_x').get();
  });

  // ==========================================
  // P5 — SELF-CREATE ACTIVE TEAM MEMBERSHIP
  // Attacker creates team_members/{attackerUid} under Hospital X
  // To test clean create, use a new attacker UID that has users.hospital = "Hospital X"
  // but no team_members record yet.
  // ==========================================
  const UID_ATTACKER_P5 = 'user_attacker_p5';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('users').doc(UID_ATTACKER_P5).set({
      name: 'Dr. Attacker P5',
      email: 'attacker_p5@hospital-x.com',
      role: 'EM Resident',
      hospital: 'Hospital X',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    });
  });

  const ctxAttackerP5 = testEnv.authenticatedContext(UID_ATTACKER_P5);
  await observe('P5', async () => {
    await ctxAttackerP5.firestore().collection('team_members').doc(UID_ATTACKER_P5).set({
      id: UID_ATTACKER_P5,
      name: 'Dr. Attacker P5',
      email: 'attacker_p5@hospital-x.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Morning',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
    });
  });

  // ==========================================
  // P6 — NEW CASE ACCESS AFTER P5
  // If P5 succeeds, attacker reads Hospital X's ownership-aware case
  // ==========================================
  await observe('P6', async () => {
    await ctxAttackerP5.firestore().collection('cases').doc('case_aware_x').get();
  });

  // ==========================================
  // P7 — EXISTING MEMBER ADDS / CHANGES hospitalId
  // Existing valid Hospital-Y member updates their OWN team_members doc:
  // hospital = "Hospital Y", but hospitalId = "hosp_x_id"
  // ==========================================
  const UID_MEMBER_Y_P7 = 'user_member_y_p7';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('users').doc(UID_MEMBER_Y_P7).set({
      name: 'Dr. Member Y P7',
      email: 'p7@hospital-y.com',
      role: 'EM Resident',
      hospital: 'Hospital Y',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_MEMBER_Y_P7).set({
      id: UID_MEMBER_Y_P7,
      name: 'Dr. Member Y P7',
      email: 'p7@hospital-y.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Morning',
      hospital: 'Hospital Y',
      hospitalId: 'hosp_y_id',
    });
  });

  const ctxMemberYP7 = testEnv.authenticatedContext(UID_MEMBER_Y_P7);
  const p7aRes = await observe('P7a', async () => {
    await ctxMemberYP7.firestore().collection('team_members').doc(UID_MEMBER_Y_P7).update({
      hospitalId: 'hosp_x_id',
    });
  });

  // P7b: Attempt to read Hospital X's ownership-aware case
  await observe('P7b', async () => {
    await ctxMemberYP7.firestore().collection('cases').doc('case_aware_x').get();
  });

  // ==========================================
  // P8 — CROSS-HOSPITAL ACCESS THROUGH P7
  // Explicitly test access to another Hospital-X ownership-aware case
  // ==========================================
  await observe('P8', async () => {
    await ctxMemberYP7.firestore().collection('cases').doc('case_aware_x_2').get();
  });

  // ==========================================
  // P9 — MEMBER ACTIVATES ANOTHER MEMBER
  // Hospital-Y ordinary clinician updates ANOTHER Hospital-Y team_members:
  // status: "inactive" -> status: "active"
  // ==========================================
  const ctxOrdinaryY = testEnv.authenticatedContext(UID_ATTACKER_Y); // Ordinary EM Resident in Hosp Y
  // First ensure attacker profile is reset to Hospital Y for clean test
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('users').doc(UID_ATTACKER_Y).update({
      hospital: 'Hospital Y',
    });
  });

  await observe('P9', async () => {
    await ctxOrdinaryY.firestore().collection('team_members').doc(UID_MEMBER_Y_2).update({
      status: 'active',
    });
  });

  // Also test active -> inactive
  await observe('P9-active-to-inactive', async () => {
    await ctxOrdinaryY.firestore().collection('team_members').doc(UID_MEMBER_Y_2).update({
      status: 'inactive',
    });
  });

  // ==========================================
  // P10 — QUICK PASTE CROSS-HOSPITAL ACCESS
  // Authenticated Hospital-Y user attempts A, B, C, D
  // ==========================================
  await observe('P10A', async () => {
    await ctxOrdinaryY.firestore().collection('quick_paste_patients').doc('paste_x').get();
  });

  await observe('P10B', async () => {
    await ctxOrdinaryY.firestore().collection('quick_paste_patients').doc('paste_attacker_created').set({
      hospital: 'Hospital Y',
      patientName: 'Injected Patient',
      notes: 'Notes',
    });
  });

  await observe('P10C', async () => {
    await ctxOrdinaryY.firestore().collection('quick_paste_patients').doc('paste_x').update({
      notes: 'Tampered notes',
    });
  });

  await observe('P10D', async () => {
    await ctxOrdinaryY.firestore().collection('quick_paste_patients').doc('paste_x').delete();
  });

  // ==========================================
  // P11 — TEAM INVITE PUBLIC ACCESS
  // Unauthenticated client attempts to read teamInvites/{validToken}
  // ==========================================
  const ctxAnon = testEnv.unauthenticatedContext();
  await observe('P11', async () => {
    await ctxAnon.firestore().collection('teamInvites').doc('invite_token_x_123').get();
  });

  // ==========================================
  // P12 — SHIFT SAVE FAILURE THEORY
  // Authenticated doctor where users/{uid}.hospital and team_members/{uid}.hospital
  // differ in formatting:
  // Case A: "Rajagiri Hospital" vs "rajagiri hospital"
  // Case B: "Rajagiri Hospital" vs "Rajagiri Hospital "
  // Attempt the client shift update: updateDoc(doc(db, "team_members", id), { shift: "night" })
  // ==========================================
  const ctxRajagiriLower = testEnv.authenticatedContext(UID_RAJAGIRI_LOWER);
  const p12Lower = await observe('P12-case-sensitivity', async () => {
    await ctxRajagiriLower.firestore().collection('team_members').doc(UID_RAJAGIRI_LOWER).update({
      shift: 'night',
    });
  });

  const ctxRajagiriTrailing = testEnv.authenticatedContext(UID_RAJAGIRI_TRAILING);
  const p12Trailing = await observe('P12-trailing-space', async () => {
    await ctxRajagiriTrailing.firestore().collection('team_members').doc(UID_RAJAGIRI_TRAILING).update({
      shift: 'night',
    });
  });

  console.log(`[OBSERVED] P12: ${p12Lower === 'ALLOW' && p12Trailing === 'ALLOW' ? 'ALLOW' : 'DENY'}`);

  console.log('[AUDIT] All tests complete');
  await testEnv.cleanup();
}

runAudit().catch((err) => {
  console.error('[AUDIT ERROR]', err);
  process.exit(1);
});
