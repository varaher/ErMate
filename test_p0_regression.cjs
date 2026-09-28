const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

async function runRegressionSuite() {
  const rulesPath = path.resolve(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'ermate-p0-regression',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  console.log('[REGRESSION] Initialized Firestore emulator test environment');

  // Identities
  const UID_HOSP_X_HOD = 'user_hosp_x_hod';
  const UID_HOSP_X_COLLEAGUE = 'user_hosp_x_colleague';
  const UID_HOSP_X_LEGACY_MEMBER = 'user_hosp_x_legacy_member';
  const UID_HOSP_X_UNVERIFIED = 'user_hosp_x_unverified';
  const UID_HOSP_Y_MEMBER = 'user_hosp_y_member';
  const UID_INDEPENDENT = 'user_independent_solo';
  const UID_MISMATCH_DISPLAY = 'user_mismatch_display';
  const UID_LEGACY_MEM_ONLY = 'user_legacy_mem_only';
  const UID_CANONICAL_MIGRATED = 'user_canonical_migrated';
  const UID_APOLLO_DOCTOR = 'user_apollo_doctor';
  const UID_PLATFORM_ADMIN = 'user_platform_admin';

  // Seed data
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. HOD at Hospital X
    await db.collection('users').doc(UID_HOSP_X_HOD).set({
      name: 'Dr. HOD X',
      email: 'hod@hospital-x.com',
      role: 'HOD / Shift Lead',
      hospital: 'Hospital X',
      aiCredits: 500,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_HOSP_X_HOD).set({
      id: UID_HOSP_X_HOD,
      name: 'Dr. HOD X',
      email: 'hod@hospital-x.com',
      role: 'hod',
      status: 'active',
      membershipVerified: true,
      shift: 'Morning',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
    });

    // 2. Colleague at Hospital X
    await db.collection('users').doc(UID_HOSP_X_COLLEAGUE).set({
      name: 'Dr. Colleague X',
      email: 'colleague@hospital-x.com',
      role: 'EM Resident',
      hospital: 'Hospital X',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_HOSP_X_COLLEAGUE).set({
      id: UID_HOSP_X_COLLEAGUE,
      name: 'Dr. Colleague X',
      email: 'colleague@hospital-x.com',
      role: 'resident',
      status: 'active',
      membershipVerified: true,
      shift: 'Morning',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
    });

    // 3. Member at Hospital Y
    await db.collection('users').doc(UID_HOSP_Y_MEMBER).set({
      name: 'Dr. Member Y',
      email: 'member@hospital-y.com',
      role: 'EM Resident',
      hospital: 'Hospital Y',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_HOSP_Y_MEMBER).set({
      id: UID_HOSP_Y_MEMBER,
      name: 'Dr. Member Y',
      email: 'member@hospital-y.com',
      role: 'resident',
      status: 'active',
      membershipVerified: true,
      shift: 'Morning',
      hospital: 'Hospital Y',
      hospitalId: 'hosp_y_id',
      hospitalName: 'Hospital Y',
    });

    // 4. Legacy member at Hospital X
    await db.collection('users').doc(UID_HOSP_X_LEGACY_MEMBER).set({
      name: 'Dr. Legacy Member',
      email: 'legacy@hospital-x.com',
      role: 'EM Resident',
      hospital: 'Hospital X',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_HOSP_X_LEGACY_MEMBER).set({
      id: UID_HOSP_X_LEGACY_MEMBER,
      name: 'Dr. Legacy Member',
      email: 'legacy@hospital-x.com',
      role: 'EM Resident',
      status: 'Active (Joined)',
      membershipVerified: true,
      shift: 'Evening',
      hospital: 'Hospital X',
    });

    // 5. Unverified member at Hospital X
    await db.collection('users').doc(UID_HOSP_X_UNVERIFIED).set({
      name: 'Dr. Unverified',
      email: 'unverified@hospital-x.com',
      role: 'EM Resident',
      hospital: 'Hospital X',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    });
    await db.collection('team_members').doc(UID_HOSP_X_UNVERIFIED).set({
      id: UID_HOSP_X_UNVERIFIED,
      name: 'Dr. Unverified',
      email: 'unverified@hospital-x.com',
      role: 'resident',
      status: 'active',
      membershipVerified: false,
      shift: 'Night',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
    });

    // 6. User with display mismatch
    await db.collection('users').doc(UID_MISMATCH_DISPLAY).set({
      name: 'Dr. Mismatch',
      email: 'mismatch@hospital-x.com',
      role: 'resident',
      hospital: '  hospital x  ',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });
    await db.collection('team_members').doc(UID_MISMATCH_DISPLAY).set({
      id: UID_MISMATCH_DISPLAY,
      name: 'Dr. Mismatch',
      email: 'mismatch@hospital-x.com',
      role: 'resident',
      status: 'active',
      membershipVerified: true,
      shift: 'Night',
      hospital: 'Hospital X',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
    });

    // 7. Independent doctor
    await db.collection('users').doc(UID_INDEPENDENT).set({
      name: 'Dr. Independent',
      email: 'solo@clinic.com',
      role: 'Doctor',
      hospital: '',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    });

    // 8. User with ONLY legacy mem-* document (no team_members/{uid})
    await db.collection('users').doc(UID_LEGACY_MEM_ONLY).set({
      name: 'Dr. Only Mem',
      email: 'onlymem@hospital-x.com',
      role: 'resident',
      hospital: 'Hospital X',
    });
    await db.collection('team_members').doc('mem-onlymem-hospital-x-com').set({
      id: 'mem-onlymem-hospital-x-com',
      email: 'onlymem@hospital-x.com',
      hospital: 'Hospital X',
      status: 'Active (Joined)',
      role: 'EM Resident'
    });

    // 9. User with canonical migrated document
    await db.collection('users').doc(UID_CANONICAL_MIGRATED).set({
      name: 'Dr. Canonical Migrated',
      email: 'canonical@hospital-x.com',
      role: 'resident',
      hospital: 'Hospital X',
    });
    await db.collection('team_members').doc(UID_CANONICAL_MIGRATED).set({
      id: UID_CANONICAL_MIGRATED,
      uid: UID_CANONICAL_MIGRATED,
      email: 'canonical@hospital-x.com',
      hospitalId: 'hosp_x_id',
      hospitalName: 'Hospital X',
      legacyHospitalNames: ['Hospital X', 'Old Hospital X Facility'],
      status: 'active',
      role: 'resident',
      membershipVerified: true,
      shift: 'Morning',
      migratedFrom: 'mem-canonical-hospital-x-com'
    });

    // 10. Apollo Doctor with legacy aliases
    await db.collection('users').doc(UID_APOLLO_DOCTOR).set({
      name: 'Dr. Apollo Clinician',
      email: 'clinician@apollo.org',
      role: 'resident',
      hospital: 'Apollo Hospital',
    });
    await db.collection('team_members').doc(UID_APOLLO_DOCTOR).set({
      id: UID_APOLLO_DOCTOR,
      uid: UID_APOLLO_DOCTOR,
      email: 'clinician@apollo.org',
      hospitalId: 'hosp_apollo_01',
      hospitalName: 'Apollo Hospital Main Campus',
      legacyHospitalNames: ['Apollo Hospital'],
      status: 'active',
      role: 'resident',
      membershipVerified: true,
      shift: 'Morning'
    });

    // 11. Platform Admin user
    await db.collection('users').doc(UID_PLATFORM_ADMIN).set({
      name: 'Platform Admin',
      email: 'varahgrp@gmail.com',
      role: 'admin',
      hospital: '',
    });

    // Seed Cases
    await db.collection('cases').doc('case_legacy_hosp_x').set({
      hospital: 'Hospital X',
      patientName: 'Legacy Patient X',
      triageCategory: 'Yellow',
    });

    await db.collection('cases').doc('case_aware_hosp_x').set({
      workspaceType: 'hospital',
      hospitalId: 'hosp_x_id',
      createdByUid: UID_HOSP_X_HOD,
      patientName: 'Aware Patient X',
      triageCategory: 'Red',
    });

    await db.collection('cases').doc('case_apollo_legacy_1').set({
      hospital: 'Apollo Hospital',
      patientName: 'Apollo Patient 1',
    });

    await db.collection('cases').doc('case_apollo_legacy_unrelated').set({
      hospital: 'Apollo Hospitals Chennai',
      patientName: 'Apollo Patient Chennai',
    });

    // Seed Handover
    await db.collection('handovers').doc('handover_hosp_x').set({
      hospital: 'Hospital X',
      shiftDate: '2026-09-25',
      summary: 'Handover report for Hospital X',
    });

    // Seed Quick Paste
    await db.collection('quick_paste_patients').doc('qp_hosp_x').set({
      hospital: 'Hospital X',
      patientName: 'Quick Patient X',
      createdByEmail: 'hod@hospital-x.com',
      notes: 'Initial triage notes',
    });

    // Seed Mortality Audits
    await db.collection('mortalityAudits').doc('audit_hosp_x').set({
      hospitalId: 'hosp_x_id',
      patientInfo: { name: 'Audit Patient X' },
      preventability: 'Potentially preventable'
    });

    await db.collection('mortalityAudits').doc('audit_hosp_y').set({
      hospitalId: 'hosp_y_id',
      patientInfo: { name: 'Audit Patient Y' },
      preventability: 'Non-preventable'
    });

    await db.collection('mortalityAudits').doc('audit_untenanted').set({
      patientInfo: { name: 'Untenanted Audit' },
      preventability: 'Under review'
    });

    // Seed Hospital Subscriptions
    await db.collection('hospital_subscriptions').doc('hosp_x_id').set({
      tier: 'premium',
      active: true
    });
    await db.collection('hospital_subscriptions').doc('hosp_y_id').set({
      tier: 'standard',
      active: true
    });
  });

  console.log('[REGRESSION] Seed data created successfully');

  // Contexts
  const ctxHodX = testEnv.authenticatedContext(UID_HOSP_X_HOD, { email: 'hod@hospital-x.com' });
  const ctxColleagueX = testEnv.authenticatedContext(UID_HOSP_X_COLLEAGUE, { email: 'colleague@hospital-x.com' });
  const ctxLegacyMember = testEnv.authenticatedContext(UID_HOSP_X_LEGACY_MEMBER, { email: 'legacy@hospital-x.com' });
  const ctxUnverified = testEnv.authenticatedContext(UID_HOSP_X_UNVERIFIED, { email: 'unverified@hospital-x.com' });
  const ctxMemberY = testEnv.authenticatedContext(UID_HOSP_Y_MEMBER, { email: 'member@hospital-y.com' });
  const ctxIndependent = testEnv.authenticatedContext(UID_INDEPENDENT, { email: 'solo@clinic.com' });
  const ctxMismatch = testEnv.authenticatedContext(UID_MISMATCH_DISPLAY, { email: 'mismatch@hospital-x.com' });
  const ctxLegacyMemOnly = testEnv.authenticatedContext(UID_LEGACY_MEM_ONLY, { email: 'onlymem@hospital-x.com' });
  const ctxCanonicalMigrated = testEnv.authenticatedContext(UID_CANONICAL_MIGRATED, { email: 'canonical@hospital-x.com' });
  const ctxApolloDoctor = testEnv.authenticatedContext(UID_APOLLO_DOCTOR, { email: 'clinician@apollo.org' });
  const ctxAdmin = testEnv.authenticatedContext(UID_PLATFORM_ADMIN, { email: 'varahgrp@gmail.com' });

  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  async function runTest(id, name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`[PASS] ${id}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${id}: ${name} ->`, err.message);
      failed++;
    }
  }

  // T1: Owner changes own team_members.status -> DENY
  await runTest('T1', 'Owner changes own team_members.status -> DENY', async () => {
    await assertFails(
      ctxColleagueX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        status: 'pending_approval',
      })
    );
  });

  // T2: Owner changes own team_members.hospitalId -> DENY
  await runTest('T2', 'Owner changes own team_members.hospitalId -> DENY', async () => {
    await assertFails(
      ctxColleagueX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        hospitalId: 'hosp_y_id',
      })
    );
  });

  // T3: Owner changes own team_members.hospitalName / legacy hospital authority field -> DENY
  await runTest('T3', 'Owner changes own team_members.hospitalName / legacy hospital authority field -> DENY', async () => {
    await assertFails(
      ctxColleagueX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        hospitalName: 'Hospital Y',
      })
    );
  });

  // T4: Trusted active HOD from Hospital X changes SAME-HOSPITAL colleague's shift -> ALLOW
  await runTest('T4', 'Trusted active HOD from Hospital X changes SAME-HOSPITAL colleague shift -> ALLOW', async () => {
    await assertSucceeds(
      ctxHodX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        shift: 'Night',
        updatedAt: new Date().toISOString(),
      })
    );
  });

  // T5: Same HOD attempts to change colleague's status -> DENY
  await runTest('T5', 'Same HOD attempts to change colleague status -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        status: 'inactive',
      })
    );
  });

  // T6: Same HOD attempts to change member in Hospital Y -> DENY
  await runTest('T6', 'Same HOD attempts to change member in Hospital Y -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('team_members').doc(UID_HOSP_Y_MEMBER).update({
        shift: 'Afternoon',
        updatedAt: new Date().toISOString(),
      })
    );
  });

  // T7: Verified active legitimate legacy member reads matching legacy ClinicalCase -> ALLOW
  await runTest('T7', 'Verified active legitimate legacy member reads matching legacy ClinicalCase -> ALLOW', async () => {
    await assertSucceeds(
      ctxLegacyMember.firestore().collection('cases').doc('case_legacy_hosp_x').get()
    );
  });

  // T8: Verified active legitimate legacy member reads matching handover -> ALLOW
  await runTest('T8', 'Verified active legitimate legacy member reads matching handover -> ALLOW', async () => {
    await assertSucceeds(
      ctxLegacyMember.firestore().collection('handovers').doc('handover_hosp_x').get()
    );
  });

  // T9: Active membership WITHOUT membershipVerified reads ownership-aware hospital case -> DENY
  await runTest('T9', 'Active membership WITHOUT membershipVerified reads ownership-aware hospital case -> DENY', async () => {
    await assertFails(
      ctxUnverified.firestore().collection('cases').doc('case_aware_hosp_x').get()
    );
  });

  // T10: Backend-shaped verified active member updates own shift + updatedAt -> ALLOW
  await runTest('T10', 'Backend-shaped verified active member updates own shift + updatedAt -> ALLOW', async () => {
    await assertSucceeds(
      ctxColleagueX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        shift: 'Evening',
        updatedAt: new Date().toISOString(),
      })
    );
  });

  // T11: Shift update succeeds regardless of users.hospital capitalization, spacing, or display mismatch -> ALLOW
  await runTest('T11', 'Shift update succeeds regardless of users.hospital capitalization, spacing, or display mismatch -> ALLOW', async () => {
    await assertSucceeds(
      ctxMismatch.firestore().collection('team_members').doc(UID_MISMATCH_DISPLAY).update({
        shift: 'Morning',
        updatedAt: new Date().toISOString(),
      })
    );
  });

  // T12: Same-hospital verified member uses legitimate Quick Paste workflow -> ALLOW
  await runTest('T12', 'Same-hospital verified member uses legitimate Quick Paste workflow -> ALLOW', async () => {
    await assertSucceeds(
      ctxColleagueX.firestore().collection('quick_paste_patients').doc('qp_hosp_x').get()
    );
    await assertSucceeds(
      ctxColleagueX.firestore().collection('quick_paste_patients').doc('qp_hosp_x_new').set({
        hospital: 'Hospital X',
        patientName: 'Colleague Quick Paste',
        notes: 'Clinical observations',
        createdByEmail: 'colleague@hospital-x.com',
      })
    );
  });

  // T13: Other-hospital user accesses that Quick Paste record -> DENY
  await runTest('T13', 'Other-hospital user accesses that Quick Paste record -> DENY', async () => {
    await assertFails(
      ctxMemberY.firestore().collection('quick_paste_patients').doc('qp_hosp_x').get()
    );
    await assertFails(
      ctxMemberY.firestore().collection('quick_paste_patients').doc('qp_hosp_x').update({
        notes: 'Tampered note',
      })
    );
  });

  // T14: Independent/unrelated user accesses hospital Quick Paste -> DENY
  await runTest('T14', 'Independent/unrelated user accesses hospital Quick Paste -> DENY', async () => {
    await assertFails(
      ctxIndependent.firestore().collection('quick_paste_patients').doc('qp_hosp_x').get()
    );
  });

  // Section 7 Leave/Deactivation
  await runTest('Section 7 Leave/Deactivation', 'Verified member reads case -> ALLOW; after deactivation -> DENY', async () => {
    await assertSucceeds(
      ctxColleagueX.firestore().collection('cases').doc('case_aware_hosp_x').get()
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        status: 'inactive',
        updatedAt: new Date().toISOString(),
        leftAt: new Date().toISOString(),
      });
    });
    await assertFails(
      ctxColleagueX.firestore().collection('cases').doc('case_aware_hosp_x').get()
    );
  });

  // LM1: legacy user with ONLY mem-* membership reads legacy case -> DENY
  await runTest('LM1', 'Legacy user with ONLY mem-* membership reads legacy case -> DENY', async () => {
    await assertFails(
      ctxLegacyMemOnly.firestore().collection('cases').doc('case_legacy_hosp_x').get()
    );
  });

  // LM2: same user after canonical UID membership migration reads legitimate legacy case -> ALLOW
  await runTest('LM2', 'Same user after canonical UID membership migration reads legitimate legacy case -> ALLOW', async () => {
    await assertSucceeds(
      ctxCanonicalMigrated.firestore().collection('cases').doc('case_legacy_hosp_x').get()
    );
  });

  // LM3: canonical migrated user updates own shift -> ALLOW
  await runTest('LM3', 'Canonical migrated user updates own shift -> ALLOW', async () => {
    await assertSucceeds(
      ctxCanonicalMigrated.firestore().collection('team_members').doc(UID_CANONICAL_MIGRATED).update({
        shift: 'Evening',
        updatedAt: new Date().toISOString()
      })
    );
  });

  // LM4: verified membership with legacyHospitalNames ["Apollo Hospital"] reads legacy case -> ALLOW
  await runTest('LM4', 'Verified membership with legacyHospitalNames reads matching legacy case -> ALLOW', async () => {
    await assertSucceeds(
      ctxApolloDoctor.firestore().collection('cases').doc('case_apollo_legacy_1').get()
    );
  });

  // LM5: user attempts to add/change legacyHospitalNames -> DENY
  await runTest('LM5', 'User attempts to add/change legacyHospitalNames -> DENY', async () => {
    await assertFails(
      ctxApolloDoctor.firestore().collection('team_members').doc(UID_APOLLO_DOCTOR).update({
        legacyHospitalNames: ['Apollo Hospital', 'Injected Hospital'],
        updatedAt: new Date().toISOString()
      })
    );
  });

  // LH1: Verified member with hospitalId: "hosp_apollo_01", legacyHospitalNames: ["Apollo Hospital"] reads legacy case -> ALLOW
  await runTest('LH1', 'LH1: Verified member reads case with matching legacyHospitalName -> ALLOW', async () => {
    await assertSucceeds(
      ctxApolloDoctor.firestore().collection('cases').doc('case_apollo_legacy_1').get()
    );
  });

  // LH2: Same member reads unrelated legacy hospital: "Apollo Hospitals Chennai" when NOT in legacyHospitalNames -> DENY
  await runTest('LH2', 'LH2: Same member reads unrelated legacy hospital -> DENY', async () => {
    await assertFails(
      ctxApolloDoctor.firestore().collection('cases').doc('case_apollo_legacy_unrelated').get()
    );
  });

  // LH3: Ordinary client attempts to add/change own legacyHospitalNames -> DENY
  await runTest('LH3', 'LH3: Ordinary client attempts to add/change own legacyHospitalNames -> DENY', async () => {
    await assertFails(
      ctxColleagueX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        legacyHospitalNames: ['Injected Legacy Hospital']
      })
    );
  });

  // LH4: HOD direct client shift update attempts simultaneously to alter legacyHospitalNames -> DENY
  await runTest('LH4', 'LH4: HOD shift update attempting to alter legacyHospitalNames -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('team_members').doc(UID_HOSP_X_COLLEAGUE).update({
        shift: 'Night',
        legacyHospitalNames: ['Forged Hospital'],
        updatedAt: new Date().toISOString()
      })
    );
  });

  // QP1: Hospital-Y doctor creates Quick Paste with hospital = Hospital X, createdByEmail = own email -> DENY
  await runTest('QP1', 'QP1: Cross-hospital quick paste injection attempt -> DENY', async () => {
    await assertFails(
      ctxMemberY.firestore().collection('quick_paste_patients').doc('qp_injection_attempt').set({
        hospital: 'Hospital X',
        patientName: 'Forged Patient',
        notes: 'Injected note',
        createdByEmail: 'member@hospital-y.com'
      })
    );
  });

  // QP2: Hospital-X member changes existing Quick Paste: Hospital X -> Hospital Y -> DENY
  await runTest('QP2', 'QP2: Hospital-X member changes existing Quick Paste hospital -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('quick_paste_patients').doc('qp_hosp_x').update({
        hospital: 'Hospital Y'
      })
    );
  });

  // QP3: user changes createdByEmail -> DENY
  await runTest('QP3', 'QP3: User changes createdByEmail on quick paste -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('quick_paste_patients').doc('qp_hosp_x').update({
        createdByEmail: 'attacker@evil.com'
      })
    );
  });

  // QP4: legitimate same-hospital content-only update -> ALLOW
  await runTest('QP4', 'QP4: Legitimate same-hospital content-only update -> ALLOW', async () => {
    await assertSucceeds(
      ctxHodX.firestore().collection('quick_paste_patients').doc('qp_hosp_x').update({
        notes: 'Updated triage observations by verified HOD'
      })
    );
  });

  // QP5: legitimate independent/creator-only item without hospital -> ALLOW
  await runTest('QP5', 'QP5: Independent creator-only quick paste without hospital -> ALLOW', async () => {
    await assertSucceeds(
      ctxIndependent.firestore().collection('quick_paste_patients').doc('qp_solo_1').set({
        hospital: '',
        patientName: 'Solo Patient',
        notes: 'Private clinic note',
        createdByEmail: 'solo@clinic.com'
      })
    );
    await assertSucceeds(
      ctxIndependent.firestore().collection('quick_paste_patients').doc('qp_solo_1').get()
    );
  });

  // RA1 / UR1: Verified HOD of Hospital A directly changes another user's users.role -> DENY
  await runTest('RA1 / UR1', 'Verified HOD directly changes another user users.role -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('users').doc(UID_HOSP_X_COLLEAGUE).update({
        role: 'HOD / Shift Lead'
      })
    );
  });

  // UR2: Hospital-A HOD attempts to change Hospital-B user's role -> DENY
  await runTest('UR2', 'Hospital-A HOD attempts to change Hospital-B user role -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('users').doc(UID_HOSP_Y_MEMBER).update({
        role: 'HOD / Shift Lead'
      })
    );
  });

  // UR3: Normal user changes own role -> DENY
  await runTest('UR3', 'Normal user changes own users.role -> DENY', async () => {
    await assertFails(
      ctxColleagueX.firestore().collection('users').doc(UID_HOSP_X_COLLEAGUE).update({
        role: 'HOD / Shift Lead'
      })
    );
  });

  // UR4: Platform admin role change -> ALLOW
  await runTest('UR4', 'Platform admin changes users.role -> ALLOW', async () => {
    await assertSucceeds(
      ctxAdmin.firestore().collection('users').doc(UID_HOSP_X_COLLEAGUE).update({
        name: 'Dr. Colleague X',
        email: 'colleague@hospital-x.com',
        role: 'Consultant',
        hospital: 'Hospital X',
        aiCredits: 100,
        streak: 1,
        subscriptionTier: 'Hospital Team Premium (Department Covered)'
      })
    );
  });

  // MA1: Verified HOD of Hospital A reads Hospital-B mortality audit -> DENY
  await runTest('MA1', 'Verified HOD of Hospital A reads Hospital-B mortality audit -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('mortalityAudits').doc('audit_hosp_y').get()
    );
  });

  // MA2: Verified HOD of Hospital A writes Hospital-B mortality audit -> DENY
  await runTest('MA2', 'Verified HOD of Hospital A writes Hospital-B mortality audit -> DENY', async () => {
    await assertFails(
      ctxHodX.firestore().collection('mortalityAudits').doc('audit_hosp_y').update({
        preventability: 'Tampered'
      })
    );
    await assertFails(
      ctxHodX.firestore().collection('mortalityAudits').doc('audit_hosp_y_new').set({
        hospitalId: 'hosp_y_id',
        preventability: 'Injected'
      })
    );
  });

  // MA3: Verified same-hospital HOD reads Hospital-A audit -> ALLOW
  await runTest('MA3', 'Verified same-hospital HOD reads Hospital-A audit -> ALLOW', async () => {
    await assertSucceeds(
      ctxHodX.firestore().collection('mortalityAudits').doc('audit_hosp_x').get()
    );
  });

  // MA4: Untenanted audit ordinary HOD DENY, platform admin ALLOW
  await runTest('MA4', 'Untenanted mortality audit: ordinary HOD -> DENY; platform admin -> ALLOW', async () => {
    await assertFails(
      ctxHodX.firestore().collection('mortalityAudits').doc('audit_untenanted').get()
    );
    await assertSucceeds(
      ctxAdmin.firestore().collection('mortalityAudits').doc('audit_untenanted').get()
    );
  });

  // Section 9: Hospital Subscriptions client writes: HOD DENY, Platform Admin ALLOW
  await runTest('Section 9 Subscriptions', 'Hospital subscriptions: HOD client write -> DENY; Platform Admin -> ALLOW', async () => {
    await assertFails(
      ctxHodX.firestore().collection('hospital_subscriptions').doc('hosp_x_id').update({
        tier: 'enterprise_free_bypass'
      })
    );
    await assertFails(
      ctxHodX.firestore().collection('hospital_subscriptions').doc('hosp_y_id').update({
        tier: 'enterprise_free_bypass'
      })
    );
    await assertSucceeds(
      ctxAdmin.firestore().collection('hospital_subscriptions').doc('hosp_x_id').update({
        tier: 'enterprise_admin_approved'
      })
    );
  });

  console.log('==========================================');
  console.log(`REGRESSION SUMMARY: ${passed} passed, ${failed} failed (total ${totalTests})`);
  console.log('==========================================');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('[REGRESSION SUITE FATAL]', err);
  process.exit(1);
});
