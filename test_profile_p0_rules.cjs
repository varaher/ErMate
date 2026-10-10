const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

async function runProfileRulesSuite() {
  const rulesPath = path.resolve(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'ermate-p0-profile-test',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  console.log('================================================================================');
  console.log('ERMATE — P0 PROFILE SAVE, FIRESTORE SECURITY & TRIAL CASE TEST SUITE');
  console.log('================================================================================\n');

  await testEnv.clearFirestore();

  // Test identities
  const UID_NEW_SOLO = 'uid_new_solo_doc';
  const EMAIL_NEW_SOLO = 'solo.doctor@ermate.test';

  const UID_EXISTING_SOLO = 'uid_existing_solo_doc';
  const EMAIL_EXISTING_SOLO = 'existing.solo@ermate.test';

  const UID_HOSP_MEMBER = 'uid_hosp_member_doc';
  const EMAIL_HOSP_MEMBER = 'member.hosp@ermate.test';
  const HOSP_ID = 'hospital_alpha_id';

  const UID_ATTACKER = 'uid_attacker_doc';
  const EMAIL_ATTACKER = 'attacker@ermate.test';

  // Seed existing users with admin privileges
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Existing solo doctor (has doc with role: 'EM Resident', hospital: '')
    await db.collection('users').doc(UID_EXISTING_SOLO).set({
      name: 'Dr. Initial Name',
      email: EMAIL_EXISTING_SOLO,
      role: 'EM Resident',
      hospital: '',
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    });

    // 2. Existing hospital member doctor
    await db.collection('users').doc(UID_HOSP_MEMBER).set({
      name: 'Dr. Hospital Resident',
      email: EMAIL_HOSP_MEMBER,
      role: 'EM Resident',
      hospital: HOSP_ID,
      aiCredits: 200,
      streak: 5,
      subscriptionTier: 'Hospital Team Premium (Department Covered)',
    });

    await db.collection('team_members').doc(UID_HOSP_MEMBER).set({
      id: UID_HOSP_MEMBER,
      name: 'Dr. Hospital Resident',
      email: EMAIL_HOSP_MEMBER,
      role: 'EM Resident',
      status: 'active',
      membershipVerified: true,
      hospitalId: HOSP_ID,
      hospital: HOSP_ID,
    });
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Contexts
  const ctxNewSolo = testEnv.authenticatedContext(UID_NEW_SOLO, { email: EMAIL_NEW_SOLO });
  const ctxExistingSolo = testEnv.authenticatedContext(UID_EXISTING_SOLO, { email: EMAIL_EXISTING_SOLO });
  const ctxHospMember = testEnv.authenticatedContext(UID_HOSP_MEMBER, { email: EMAIL_HOSP_MEMBER });
  const ctxAttacker = testEnv.authenticatedContext(UID_ATTACKER, { email: EMAIL_ATTACKER });

  console.log('--- SECTION 1: NEW USER FIRST-TIME PROFILE CREATION ---');

  await test('1.1 New user creates initial profile doc with clean informational workplace & displayRole -> ALLOW', async () => {
    const payload = {
      name: 'Dr. Priya Sharma',
      email: EMAIL_NEW_SOLO,
      role: 'EM Resident', // Valid authorized default allowed by create rule
      hospital: '', // Strictly empty string as required by create rule
      hospitalLabel: 'Manipal Hospital Bangalore',
      workplaceName: 'Manipal Hospital Bangalore',
      displayRole: 'Emergency Medicine Registrar',
      department: 'Emergency & Trauma Medicine',
      erPhysicalBedCapacity: 35,
      onboardingComplete: true,
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    };

    await assertSucceeds(
      ctxNewSolo.firestore().collection('users').doc(UID_NEW_SOLO).set(payload)
    );
  });

  await test('1.2 New user attempting to self-set non-empty users.hospital on creation -> DENY', async () => {
    const maliciousPayload = {
      name: 'Dr. Untrusted Create',
      email: EMAIL_ATTACKER,
      role: 'EM Resident',
      hospital: 'Unauthorized Hospital Injection', // Fails (!('hospital' in incoming()) || incoming().hospital == '')
      aiCredits: 100,
      streak: 1,
      subscriptionTier: 'Free Standard',
    };

    await assertFails(
      ctxAttacker.firestore().collection('users').doc(UID_ATTACKER).set(maliciousPayload)
    );
  });

  console.log('\n--- SECTION 2: EXISTING INDIVIDUAL USER PROFILE UPDATES ---');

  await test('2.1 Existing individual doctor updates workplaceName, hospitalLabel, displayRole & bed capacity -> ALLOW', async () => {
    // App.tsx payload preserves existingData.role ('EM Resident') and existingData.hospital ('')
    const updatePayload = {
      name: 'Dr. Rajesh Kumar, MD',
      email: EMAIL_EXISTING_SOLO,
      role: 'EM Resident', // Strictly preserved authorized role
      hospital: '', // Strictly preserved authorized hospital
      hospitalLabel: 'Apollo Hospitals Bannerghatta',
      workplaceName: 'Apollo Hospitals Bannerghatta',
      displayRole: 'Senior Emergency Physician',
      department: 'Emergency Care Centre',
      erPhysicalBedCapacity: 40,
      onboardingComplete: true,
      aiCredits: 100, // Strictly preserved
      streak: 1, // Strictly preserved
      subscriptionTier: 'Free Standard', // Strictly preserved
    };

    await assertSucceeds(
      ctxExistingSolo.firestore().collection('users').doc(UID_EXISTING_SOLO).set(updatePayload, { merge: true })
    );
  });

  await test('2.2 Existing doctor attempting to elevate own users.role to HOD / Shift Lead -> DENY', async () => {
    const forbiddenEscalation = {
      role: 'HOD / Shift Lead', // Violates (!('role' in incoming()) || incoming().role == existing().role)
    };

    await assertFails(
      ctxExistingSolo.firestore().collection('users').doc(UID_EXISTING_SOLO).update(forbiddenEscalation)
    );
  });

  await test('2.3 Existing doctor attempting to write unauthorized users.hospital -> DENY', async () => {
    const forbiddenHospitalChange = {
      hospital: 'Some Other Hospital ID', // Violates incoming().get('hospital', '') == existing().get('hospital', '')
    };

    await assertFails(
      ctxExistingSolo.firestore().collection('users').doc(UID_EXISTING_SOLO).update(forbiddenHospitalChange)
    );
  });

  await test('2.4 Existing doctor attempting to self-grant extra aiCredits or subscriptionTier -> DENY', async () => {
    await assertFails(
      ctxExistingSolo.firestore().collection('users').doc(UID_EXISTING_SOLO).update({ aiCredits: 999999 })
    );
    await assertFails(
      ctxExistingSolo.firestore().collection('users').doc(UID_EXISTING_SOLO).update({ subscriptionTier: 'Enterprise Unlimited' })
    );
  });

  console.log('\n--- SECTION 3: HOSPITAL TEAM MEMBER PROFILE UPDATES ---');

  await test('3.1 Verified hospital doctor updates workplace display labels while preserving authorized hospital & role -> ALLOW', async () => {
    const hospMemberUpdate = {
      name: 'Dr. Hospital Resident, DNB',
      email: EMAIL_HOSP_MEMBER,
      role: 'EM Resident', // Strictly preserved
      hospital: HOSP_ID, // Strictly preserved
      hospitalLabel: 'Hospital Alpha - Main Campus',
      workplaceName: 'Hospital Alpha - Main Campus',
      displayRole: 'Specialist Registrar',
      department: 'Pediatric & Adult Emergency',
      erPhysicalBedCapacity: 50,
      onboardingComplete: true,
      aiCredits: 200, // Strictly preserved
      streak: 5, // Strictly preserved
      subscriptionTier: 'Hospital Team Premium (Department Covered)', // Strictly preserved
    };

    await assertSucceeds(
      ctxHospMember.firestore().collection('users').doc(UID_HOSP_MEMBER).set(hospMemberUpdate, { merge: true })
    );
  });

  console.log('\n--- SECTION 4: TRIAL CASE CONVERSION TO CANONICAL INDIVIDUAL CASE ---');

  await test('4.1 Independent doctor saves trial case permanently as individual case -> ALLOW', async () => {
    const realCaseId = 'case_real_persisted_123';
    const caseData = {
      id: realCaseId,
      displayId: 'ER-2026-0042',
      workspaceType: 'individual',
      ownerUid: UID_NEW_SOLO,
      hospitalId: null,
      hospital: '',
      doctorEmail: EMAIL_NEW_SOLO,
      doctorName: 'Dr. Priya Sharma',
      createdBy: UID_NEW_SOLO,
      createdByUid: UID_NEW_SOLO,
      lastEditedBy: UID_NEW_SOLO,
      lastEditedAt: new Date().toISOString(),
      patient: {
        name: 'Patient John Doe',
        age: '45',
        gender: 'Male',
        chiefComplaint: 'Chest tightness for 2 hours',
      },
      triage: 'Yellow',
      status: 'Active',
    };

    await assertSucceeds(
      ctxNewSolo.firestore().collection('cases').doc(realCaseId).set(caseData)
    );
  });

  await test('4.2 Another doctor cannot read or tamper with the independent doctor\'s case -> DENY', async () => {
    const realCaseId = 'case_real_persisted_123';

    await assertFails(
      ctxAttacker.firestore().collection('cases').doc(realCaseId).get()
    );

    await assertFails(
      ctxAttacker.firestore().collection('cases').doc(realCaseId).update({ status: 'Tampered' })
    );
  });

  await test('4.3 Owner doctor can update and read own persisted case -> ALLOW', async () => {
    const realCaseId = 'case_real_persisted_123';

    await assertSucceeds(
      ctxNewSolo.firestore().collection('cases').doc(realCaseId).get()
    );

    await assertSucceeds(
      ctxNewSolo.firestore().collection('cases').doc(realCaseId).update({
        notes: 'ECG shows normal sinus rhythm, troponin negative',
        lastEditedBy: UID_NEW_SOLO,
        lastEditedAt: new Date().toISOString(),
      })
    );
  });

  console.log('\n================================================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  console.log('================================================================================');

  await testEnv.cleanup();
  console.log('\n[COMPLETE] Cleaned up test environment.');
  process.exit(failed > 0 ? 1 : 0);
}

runProfileRulesSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
