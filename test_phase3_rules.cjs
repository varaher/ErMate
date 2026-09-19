const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

async function runTests() {
  const rulesPath = path.resolve(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'ermate-e8f01',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  console.log('[EXECUTED] Test environment initialized with firestore.rules on port 8085');

  // Test identities
  const UID_HOSP_A_1 = 'user_hosp_a_1'; // Active in HospA
  const UID_HOSP_A_2 = 'user_hosp_a_2'; // Active in HospA (colleague)
  const UID_HOSP_A_INACTIVE = 'user_hosp_a_inactive'; // Inactive in HospA
  const UID_HOSP_B = 'user_hosp_b_1'; // Active in HospB
  const UID_INDIVIDUAL = 'user_individual_solo'; // No hospital membership
  const UID_OTHER = 'user_other_intruder';

  // Seed baseline data with admin privileges
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Team memberships
    await db.collection('team_members').doc(UID_HOSP_A_1).set({
      id: UID_HOSP_A_1,
      name: 'Dr. Hosp A Primary',
      email: 'a1@hospital.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Morning',
      hospital: 'Hospital Alpha',
      hospitalId: 'hosp_alpha_id',
    });

    await db.collection('team_members').doc(UID_HOSP_A_2).set({
      id: UID_HOSP_A_2,
      name: 'Dr. Hosp A Colleague',
      email: 'a2@hospital.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Evening',
      hospital: 'Hospital Alpha',
      hospitalId: 'hosp_alpha_id',
    });

    await db.collection('team_members').doc(UID_HOSP_A_INACTIVE).set({
      id: UID_HOSP_A_INACTIVE,
      name: 'Dr. Hosp A Suspended',
      email: 'a_susp@hospital.com',
      role: 'EM Resident',
      status: 'inactive',
      shift: 'Off',
      hospital: 'Hospital Alpha',
      hospitalId: 'hosp_alpha_id',
    });

    await db.collection('team_members').doc(UID_HOSP_B).set({
      id: UID_HOSP_B,
      name: 'Dr. Hosp B Active',
      email: 'b@hospital.com',
      role: 'EM Resident',
      status: 'active',
      shift: 'Night',
      hospital: 'Hospital Beta',
      hospitalId: 'hosp_beta_id',
    });

    // 2. User profiles (for sameHospital legacy fallback)
    await db.collection('users').doc(UID_HOSP_A_1).set({
      name: 'Dr. Hosp A Primary',
      email: 'a1@hospital.com',
      role: 'EM Resident',
      hospital: 'Hospital Alpha',
    });
    await db.collection('users').doc(UID_HOSP_A_2).set({
      name: 'Dr. Hosp A Colleague',
      email: 'a2@hospital.com',
      role: 'EM Resident',
      hospital: 'Hospital Alpha',
    });
    await db.collection('users').doc(UID_HOSP_B).set({
      name: 'Dr. Hosp B Active',
      email: 'b@hospital.com',
      role: 'EM Resident',
      hospital: 'Hospital Beta',
    });
    await db.collection('users').doc(UID_INDIVIDUAL).set({
      name: 'Dr. Solo Practitioner',
      email: 'solo@private.com',
      role: 'EM Resident',
      hospital: 'Solo Clinic',
    });

    // 3. Existing Hospital Case in HospA
    await db.collection('cases').doc('case_hosp_a_existing').set({
      patientName: 'Patient HospA Existing',
      workspaceType: 'hospital',
      createdByUid: UID_HOSP_A_1,
      hospitalId: 'hosp_alpha_id',
      chiefComplaints: 'Chest pain',
    });

    // 4. Existing Individual Case
    await db.collection('cases').doc('case_individual_existing').set({
      patientName: 'Patient Solo Existing',
      workspaceType: 'individual',
      createdByUid: UID_INDIVIDUAL,
      ownerUid: UID_INDIVIDUAL,
      chiefComplaints: 'Knee injury',
    });

    // 5. Existing Legacy Case
    await db.collection('cases').doc('case_legacy_existing').set({
      patientName: 'Patient Legacy Existing',
      hospital: 'Hospital Alpha',
      chiefComplaints: 'Fever and chills',
    });

    // 6. Subcollections
    await db.collection('cases').doc('case_hosp_a_existing').collection('notes').doc('note1').set({
      text: 'HospA Clinical Note',
    });
    await db.collection('cases').doc('case_individual_existing').collection('notes').doc('note1').set({
      text: 'Solo Clinical Note',
    });
    await db.collection('cases').doc('case_legacy_existing').collection('notes').doc('note1').set({
      text: 'Legacy Clinical Note',
    });

    // 7. Logbook entries
    await db.collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry1').set({
      procedureName: 'Central Line Placement',
      supervisor: 'Dr. Consultant',
      date: '2026-09-18',
    });
  });

  console.log('[EXECUTED] Test data seeded successfully');

  let passed = 0;
  let failed = 0;

  async function test(id, description, fn) {
    try {
      await fn();
      console.log(`[CODE VERIFIED] [PASS] ${id}: ${description}`);
      passed++;
    } catch (err) {
      console.error(`[CODE VERIFIED] [FAIL] ${id}: ${description}\n  Error: ${err.message}`);
      failed++;
    }
  }

  // Pre-configured authenticated contexts with standard user email claims
  const ctxHospA1 = testEnv.authenticatedContext(UID_HOSP_A_1, { email: 'a1@hospital.com' });
  const ctxHospA2 = testEnv.authenticatedContext(UID_HOSP_A_2, { email: 'a2@hospital.com' });
  const ctxHospASuspended = testEnv.authenticatedContext(UID_HOSP_A_INACTIVE, { email: 'a_susp@hospital.com' });
  const ctxHospB = testEnv.authenticatedContext(UID_HOSP_B, { email: 'b@hospital.com' });
  const ctxSolo = testEnv.authenticatedContext(UID_INDIVIDUAL, { email: 'solo@private.com' });
  const ctxAnon = testEnv.unauthenticatedContext();

  // ==========================================
  // A. Hospital Cases: Create
  // ==========================================
  await test('A1', 'User with active membership in HospA creates case with workspaceType="hospital", createdByUid=own, hospitalId=HospA, ownerUid=null -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('cases').doc('case_a1').set({
        workspaceType: 'hospital',
        createdByUid: UID_HOSP_A_1,
        hospitalId: 'hosp_alpha_id',
        patientName: 'Patient A1',
      })
    );
  });

  await test('A2', 'User tries to set createdByUid to someone else -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_a2').set({
        workspaceType: 'hospital',
        createdByUid: UID_HOSP_A_2,
        hospitalId: 'hosp_alpha_id',
        patientName: 'Patient A2',
      })
    );
  });

  await test('A3', 'User tries to create hospital case with hospitalId for which they have NO active membership -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_a3').set({
        workspaceType: 'hospital',
        createdByUid: UID_HOSP_A_1,
        hospitalId: 'hosp_beta_id',
        patientName: 'Patient A3',
      })
    );
  });

  await test('A4', 'User tries to create hospital case with an ownerUid set -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_a4').set({
        workspaceType: 'hospital',
        createdByUid: UID_HOSP_A_1,
        hospitalId: 'hosp_alpha_id',
        ownerUid: UID_HOSP_A_1,
        patientName: 'Patient A4',
      })
    );
  });

  await test('A5', 'User with inactive/suspended membership tries to create hospital case -> DENY', async () => {
    await assertFails(
      ctxHospASuspended.firestore().collection('cases').doc('case_a5').set({
        workspaceType: 'hospital',
        createdByUid: UID_HOSP_A_INACTIVE,
        hospitalId: 'hosp_alpha_id',
        patientName: 'Patient A5',
      })
    );
  });

  await test('A6', 'User without workspaceType tries to create new case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_a6').set({
        hospital: 'Hospital Alpha',
        patientName: 'Patient A6',
      })
    );
  });

  // ==========================================
  // B. Individual Cases: Create
  // ==========================================
  await test('B1', 'Free solo user (no active hospital membership) creates individual case: workspaceType="individual", createdByUid=own, ownerUid=own, hospitalId=null -> ALLOW', async () => {
    await assertSucceeds(
      ctxSolo.firestore().collection('cases').doc('case_b1').set({
        workspaceType: 'individual',
        createdByUid: UID_INDIVIDUAL,
        ownerUid: UID_INDIVIDUAL,
        patientName: 'Patient B1',
      })
    );
  });

  await test('B2', 'User WITH active hospital membership tries to create individual case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_b2').set({
        workspaceType: 'individual',
        createdByUid: UID_HOSP_A_1,
        ownerUid: UID_HOSP_A_1,
        patientName: 'Patient B2',
      })
    );
  });

  await test('B3', 'User tries to create individual case with ownerUid != auth.uid -> DENY', async () => {
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_b3').set({
        workspaceType: 'individual',
        createdByUid: UID_INDIVIDUAL,
        ownerUid: UID_OTHER,
        patientName: 'Patient B3',
      })
    );
  });

  await test('B4', 'User tries to create individual case with hospitalId set -> DENY', async () => {
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_b4').set({
        workspaceType: 'individual',
        createdByUid: UID_INDIVIDUAL,
        ownerUid: UID_INDIVIDUAL,
        hospitalId: 'hosp_alpha_id',
        patientName: 'Patient B4',
      })
    );
  });

  await test('B5', 'User tries to create individual case with createdByUid != auth.uid -> DENY', async () => {
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_b5').set({
        workspaceType: 'individual',
        createdByUid: UID_OTHER,
        ownerUid: UID_INDIVIDUAL,
        patientName: 'Patient B5',
      })
    );
  });

  await test('B6', 'Unauthenticated user tries to create individual case -> DENY', async () => {
    await assertFails(
      ctxAnon.firestore().collection('cases').doc('case_b6').set({
        workspaceType: 'individual',
        createdByUid: 'anon',
        ownerUid: 'anon',
        patientName: 'Patient B6',
      })
    );
  });

  // ==========================================
  // C. Hospital Cases: Read and Update
  // ==========================================
  await test('C1', 'Active member of HospA reads hospital case in HospA -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA2.firestore().collection('cases').doc('case_hosp_a_existing').get()
    );
  });

  await test('C2', 'Active member of HospB reads hospital case in HospA -> DENY', async () => {
    await assertFails(
      ctxHospB.firestore().collection('cases').doc('case_hosp_a_existing').get()
    );
  });

  await test('C3', 'Active member of HospA updates clinical fields on hospital case in HospA -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA2.firestore().collection('cases').doc('case_hosp_a_existing').update({
        chiefComplaints: 'Chest pain, resolved with nitroglycerin',
      })
    );
  });

  await test('C4', 'Active member of HospA tries to change hospitalId on hospital case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_hosp_a_existing').update({
        hospitalId: 'hosp_beta_id',
      })
    );
  });

  await test('C5', 'Active member of HospA tries to change createdByUid on hospital case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_hosp_a_existing').update({
        createdByUid: UID_HOSP_A_2,
      })
    );
  });

  await test('C6', 'Inactive/removed member of HospA tries to read hospital case in HospA -> DENY', async () => {
    await assertFails(
      ctxHospASuspended.firestore().collection('cases').doc('case_hosp_a_existing').get()
    );
  });

  // ==========================================
  // D. Individual Cases: Read, Update, Delete
  // ==========================================
  await test('D1', 'Owner reads own individual case -> ALLOW', async () => {
    await assertSucceeds(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').get()
    );
  });

  await test('D2', 'Non-owner reads individual case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_individual_existing').get()
    );
  });

  await test('D3', 'Owner updates clinical fields on individual case -> ALLOW', async () => {
    await assertSucceeds(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').update({
        chiefComplaints: 'Knee injury - MRI ordered',
      })
    );
  });

  await test('D4', 'Owner tries to change ownerUid or hospitalId on individual case -> DENY', async () => {
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').update({
        ownerUid: UID_OTHER,
      })
    );
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').update({
        hospitalId: 'hosp_alpha_id',
      })
    );
  });

  await test('D5', 'Owner tries to delete own individual case -> DENY', async () => {
    await assertFails(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').delete()
    );
  });

  // ==========================================
  // E. Legacy Cases: Read, Update, Protect
  // ==========================================
  await test('E1', 'User from same legacy hospital reads legacy case -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('cases').doc('case_legacy_existing').get()
    );
  });

  await test('E2', 'User from different hospital reads legacy case -> DENY', async () => {
    await assertFails(
      ctxHospB.firestore().collection('cases').doc('case_legacy_existing').get()
    );
  });

  await test('E3', 'User from same hospital updates clinical fields on legacy case without Phase-3 fields -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('cases').doc('case_legacy_existing').update({
        chiefComplaints: 'Fever and chills, blood culture sent',
      })
    );
  });

  await test('E4', 'User tries to update legacy case by injecting workspaceType="hospital" -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_legacy_existing').update({
        workspaceType: 'hospital',
      })
    );
  });

  await test('E5', 'User tries to update legacy case by injecting ownerUid -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_legacy_existing').update({
        ownerUid: UID_HOSP_A_1,
      })
    );
  });

  // ==========================================
  // F. Subcollections: Inherited Access
  // ==========================================
  await test('F1', 'Active member of HospA reads/writes subcollection of HospA hospital case -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA2.firestore().collection('cases').doc('case_hosp_a_existing').collection('notes').doc('note1').get()
    );
    await assertSucceeds(
      ctxHospA2.firestore().collection('cases').doc('case_hosp_a_existing').collection('notes').doc('note2').set({
        text: 'Colleague note',
      })
    );
  });

  await test('F2', 'Member of HospB reads/writes subcollection of HospA hospital case -> DENY', async () => {
    await assertFails(
      ctxHospB.firestore().collection('cases').doc('case_hosp_a_existing').collection('notes').doc('note1').get()
    );
    await assertFails(
      ctxHospB.firestore().collection('cases').doc('case_hosp_a_existing').collection('notes').doc('note3').set({
        text: 'HospB intrusion',
      })
    );
  });

  await test('F3', 'Owner reads/writes subcollection of own individual case -> ALLOW', async () => {
    await assertSucceeds(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').collection('notes').doc('note1').get()
    );
    await assertSucceeds(
      ctxSolo.firestore().collection('cases').doc('case_individual_existing').collection('notes').doc('note2').set({
        text: 'Owner followup note',
      })
    );
  });

  await test('F4', 'Non-owner reads/writes subcollection of individual case -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_individual_existing').collection('notes').doc('note1').get()
    );
    await assertFails(
      ctxHospA1.firestore().collection('cases').doc('case_individual_existing').collection('notes').doc('note4').set({
        text: 'Intruder note',
      })
    );
  });

  // ==========================================
  // G. Log Book and Team Members
  // ==========================================
  await test('G1', 'Doctor reads own logbook -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry1').get()
    );
  });

  await test('G2', 'Another doctor (even HOD/same hospital) reads doctor\'s logbook -> DENY', async () => {
    await assertFails(
      ctxHospA2.firestore().collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry1').get()
    );
  });

  await test('G3', 'Client tries to directly create logbook entry -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry2').set({
        procedureName: 'Intubation',
      })
    );
  });

  await test('G4', 'Doctor updates own logbook entry allowed fields (learningPoints, skills, updatedAt) -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry1').update({
        learningPoints: 'First-attempt success under ultrasound guidance',
        skills: ['Ultrasound Guidance', 'Aseptic Technique'],
        updatedAt: new Date().toISOString(),
      })
    );
  });

  await test('G4b', 'Doctor tries to modify trusted immutable logbook field (e.g. procedureName or hospitalIdAtTime) -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('users').doc(UID_HOSP_A_1).collection('logbook').doc('entry1').update({
        procedureName: 'Hacked Procedure',
      })
    );
  });

  await test('G5', 'Doctor reads own team_member doc -> ALLOW', async () => {
    await assertSucceeds(
      ctxHospA1.firestore().collection('team_members').doc(UID_HOSP_A_1).get()
    );
  });

  await test('G6', 'Doctor reads other doctor\'s team_member doc in different hospital -> DENY', async () => {
    await assertFails(
      ctxHospA1.firestore().collection('team_members').doc(UID_HOSP_B).get()
    );
  });

  console.log('\n==========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
  console.log('==========================================');

  await testEnv.cleanup();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[EXECUTED] Test runner error:', err);
  process.exit(1);
});
