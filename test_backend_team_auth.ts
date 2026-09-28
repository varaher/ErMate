/**
 * test_backend_team_auth.ts
 * 
 * Verifies the REAL backend teamRouter mounted on an Express server against the
 * Firestore emulator on port 8085.
 * 
 * All HTTP requests are sent using native HTTP to the actual routes:
 * - /api/team/create-invite
 * - /api/team/accept-invite
 * - /api/team/request-join
 * - /api/team/approve-member
 * - /api/team/decline-member
 * - /api/team/remove-member
 * - /api/team/leave
 */

import express from 'express';
import http from 'http';
import { adminAuth, db } from './src/lib/firebase-admin.ts';
import teamRouter from './server/routes/team.routes.ts';

// Lightweight request helper using native node http
function request(app: express.Express) {
  const server = http.createServer(app);
  return {
    post: (url: string, token?: string) => ({
      send: (body?: any) => new Promise<{ status: number; body: any }>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          const port = addr.port;
          const postData = JSON.stringify(body || {});
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(postData))
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const req = http.request({
            host: '127.0.0.1',
            port,
            path: url,
            method: 'POST',
            headers
          }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              server.close();
              let parsedBody: any = {};
              try { parsedBody = JSON.parse(data); } catch (e) { parsedBody = data; }
              resolve({ status: res.statusCode || 500, body: parsedBody });
            });
          });

          req.on('error', (err) => {
            server.close();
            reject(err);
          });
          req.write(postData);
          req.end();
        });
      })
    })
  };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' REAL-ROUTE BACKEND TEAM AUTHORIZATION TEST SUITE');
  console.log('========================================================================\n');

  // Token registry for mock authentication
  const mockTokens = new Map<string, any>();
  const mockUsersByUid = new Map<string, any>();

  function registerMockToken(token: string, user: any) {
    mockTokens.set(token, user);
    if (user && user.uid) {
      mockUsersByUid.set(user.uid, user);
    }
  }

  function registerMockUser(user: any) {
    if (user && user.uid) {
      mockUsersByUid.set(user.uid, user);
    }
  }

  // Stub adminAuth.verifyIdToken to resolve test tokens or reject invalid ones
  adminAuth.verifyIdToken = async (token: string) => {
    if (token === 'INVALID_TOKEN' || token === 'EXPIRED_TOKEN') {
      throw new Error('Firebase ID token is invalid or expired.');
    }
    const user = mockTokens.get(token);
    if (!user) {
      throw new Error(`Token "${token}" not registered in test environment.`);
    }
    return user;
  };

  // Stub adminAuth.getUser to resolve mock users or throw not-found
  adminAuth.getUser = async (uid: string) => {
    const user = mockUsersByUid.get(uid);
    if (!user) {
      const err: any = new Error(`Firebase Auth user "${uid}" not found.`);
      err.code = 'auth/user-not-found';
      throw err;
    }
    return user;
  };

  // Mount the ACTUAL Express team router
  const app = express();
  app.use(express.json());
  app.use('/api/team', teamRouter);
  const client = request(app);

  let passed = 0;
  let failed = 0;

  async function test(id: string, desc: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${id}: ${desc}`);
      passed++;
    } catch (e: any) {
      console.error(`[FAIL] ${id}: ${desc} ->`, e.message);
      failed++;
    }
  }

  // Define User Identities
  const USER_HOD_A = { uid: 'user_hod_a', email: 'hod.a@hospital.org', name: 'Dr. HOD A' };
  const USER_HOD_A2 = { uid: 'user_hod_a2', email: 'hod.a2@hospital.org', name: 'Dr. HOD A2' };
  const USER_HOD_INACTIVE = { uid: 'user_hod_inactive', email: 'hod.inactive@hospital.org', name: 'Dr. HOD Inactive' };
  const USER_HOD_UNVERIFIED = { uid: 'user_hod_unverified', email: 'hod.unverified@hospital.org', name: 'Dr. HOD Unverified' };
  const USER_HOD_B = { uid: 'user_hod_b', email: 'hod.b@hospital-b.org', name: 'Dr. HOD B' };
  const USER_RESIDENT_A = { uid: 'user_res_a', email: 'res.a@hospital.org', name: 'Dr. Resident A' };
  const USER_APPLICANT = { uid: 'user_applicant', email: 'applicant@gmail.com', name: 'Dr. Applicant' };
  const USER_INVITEE = { uid: 'user_invitee', email: 'invitee@gmail.com', name: 'Dr. Invitee' };
  const USER_PLATFORM_ADMIN = { uid: 'user_platform_admin', email: 'varahgrp@gmail.com', name: 'Platform Admin' };

  // Register Tokens
  registerMockToken('token_hod_a', USER_HOD_A);
  registerMockToken('token_hod_a2', USER_HOD_A2);
  registerMockToken('token_hod_inactive', USER_HOD_INACTIVE);
  registerMockToken('token_hod_unverified', USER_HOD_UNVERIFIED);
  registerMockToken('token_hod_b', USER_HOD_B);
  registerMockToken('token_res_a', USER_RESIDENT_A);
  registerMockToken('token_applicant', USER_APPLICANT);
  registerMockToken('token_invitee', USER_INVITEE);
  registerMockToken('token_platform_admin', USER_PLATFORM_ADMIN);

  // Seed Initial Database State
  // 0. Seed Users Docs
  await db.collection('users').doc(USER_HOD_A.uid).set({
    uid: USER_HOD_A.uid,
    email: USER_HOD_A.email,
    hospital: 'Hospital Alpha'
  });
  await db.collection('users').doc(USER_HOD_A2.uid).set({
    uid: USER_HOD_A2.uid,
    email: USER_HOD_A2.email,
    hospital: 'Hospital Alpha'
  });
  await db.collection('users').doc(USER_INVITEE.uid).set({
    uid: USER_INVITEE.uid,
    email: USER_INVITEE.email,
    hospital: ''
  });

  // 1. Hospital A Members
  await db.collection('team_members').doc(USER_HOD_A.uid).set({
    id: USER_HOD_A.uid,
    uid: USER_HOD_A.uid,
    email: USER_HOD_A.email,
    name: USER_HOD_A.name,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    hospital: 'Hospital Alpha',
    role: 'HOD / Department Lead',
    status: 'active',
    membershipVerified: true
  });

  await db.collection('team_members').doc(USER_RESIDENT_A.uid).set({
    id: USER_RESIDENT_A.uid,
    uid: USER_RESIDENT_A.uid,
    email: USER_RESIDENT_A.email,
    name: USER_RESIDENT_A.name,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    hospital: 'Hospital Alpha',
    role: 'EM Resident',
    status: 'active',
    membershipVerified: true
  });

  // 2. Hospital B HOD
  await db.collection('team_members').doc(USER_HOD_B.uid).set({
    id: USER_HOD_B.uid,
    uid: USER_HOD_B.uid,
    email: USER_HOD_B.email,
    name: USER_HOD_B.name,
    hospitalId: 'hosp_b_canonical',
    hospitalName: 'Hospital Beta',
    hospital: 'Hospital Beta',
    role: 'HOD / Shift Lead',
    status: 'active',
    membershipVerified: true
  });

  // ==========================================
  // AP: approve-member Tests (Real Route)
  // ==========================================
  const PENDING_MEMBER_A = 'pending_member_a_uid';
  registerMockUser({ uid: PENDING_MEMBER_A, email: 'pending.a@hospital.org', name: 'Dr. Pending A' });
  await db.collection('team_members').doc(PENDING_MEMBER_A).set({
    id: PENDING_MEMBER_A,
    uid: PENDING_MEMBER_A,
    email: 'pending.a@hospital.org',
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });

  await test('AP1', 'Active verified HOD of Hospital A approves pending member in Hospital A -> ALLOW (200)', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: PENDING_MEMBER_A
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const updated = await db.collection('team_members').doc(PENDING_MEMBER_A).get();
    if (updated.data()?.status !== 'active' || updated.data()?.membershipVerified !== true) {
      throw new Error('Target was not marked active and verified');
    }
  });

  // Reset to pending for subsequent negative tests
  await db.collection('team_members').doc(PENDING_MEMBER_A).update({
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });

  await test('AP2', 'Unverified HOD approves pending member -> DENY (403)', async () => {
    const UNVERIFIED_HOD_UID = 'unverified_hod_caller';
    registerMockToken('token_unverified_hod', { uid: UNVERIFIED_HOD_UID, email: 'unverified.hod@hospital.org' });
    await db.collection('team_members').doc(UNVERIFIED_HOD_UID).set({
      id: UNVERIFIED_HOD_UID,
      uid: UNVERIFIED_HOD_UID,
      email: 'unverified.hod@hospital.org',
      hospitalId: 'hosp_a_canonical',
      role: 'hod',
      status: 'active',
      membershipVerified: false // UNVERIFIED!
    });

    const res = await client.post('/api/team/approve-member', 'token_unverified_hod').send({
      memberId: PENDING_MEMBER_A
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('AP3', 'Ordinary clinician (non-HOD) approves pending member -> DENY (403)', async () => {
    const res = await client.post('/api/team/approve-member', 'token_res_a').send({
      memberId: PENDING_MEMBER_A
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('AP4', 'HOD of Hospital B attempts to approve pending member of Hospital A -> DENY (403)', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_b').send({
      memberId: PENDING_MEMBER_A
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('AP5', 'HOD attempts to approve a member who is NOT pending_approval -> DENY (400)', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: USER_RESIDENT_A.uid // already active
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  // ── AP6 to AP9: Firebase Auth Identity Binding Tests ──
  const APPLICANT_AP6 = 'applicant_ap6_nonexistent_auth';
  await db.collection('team_members').doc(APPLICANT_AP6).set({
    id: APPLICANT_AP6,
    uid: APPLICANT_AP6,
    email: 'nonexistent.auth@hospital.org',
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });
  // Note: APPLICANT_AP6 is NOT in mockUsersByUid

  await test('AP6', 'pending request with invalid/nonexistent Firebase Auth UID -> DENY', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: APPLICANT_AP6
    });
    if (res.status !== 400 || !res.body.error?.includes('Firebase Auth')) {
      throw new Error(`Expected 400 with Firebase Auth error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const APPLICANT_AP7_DOC = 'applicant_ap7_doc_id';
  const APPLICANT_AP7_UID = 'applicant_ap7_different_uid';
  registerMockUser({ uid: APPLICANT_AP7_UID, email: 'ap7@hospital.org' });
  await db.collection('team_members').doc(APPLICANT_AP7_DOC).set({
    id: APPLICANT_AP7_DOC,
    uid: APPLICANT_AP7_UID,
    email: 'ap7@hospital.org',
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });

  await test('AP7', 'target.uid/document ID mismatch -> DENY', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: APPLICANT_AP7_DOC
    });
    if (res.status !== 400 || !res.body.error?.includes('Target document ID does not match')) {
      throw new Error(`Expected 400 with ID mismatch error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const APPLICANT_AP8 = 'applicant_ap8_uid';
  registerMockUser({ uid: APPLICANT_AP8, email: 'real.auth.email@hospital.org' });
  await db.collection('team_members').doc(APPLICANT_AP8).set({
    id: APPLICANT_AP8,
    uid: APPLICANT_AP8,
    email: 'spoofed.doc.email@hospital.org',
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });

  await test('AP8', 'target.email != Firebase Auth email -> DENY', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: APPLICANT_AP8
    });
    if (res.status !== 400 || !res.body.error?.includes('Target email does not match')) {
      throw new Error(`Expected 400 with email mismatch error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const APPLICANT_AP9 = 'applicant_ap9_uid';
  registerMockUser({ uid: APPLICANT_AP9, email: 'valid.applicant@hospital.org' });
  await db.collection('team_members').doc(APPLICANT_AP9).set({
    id: APPLICANT_AP9,
    uid: APPLICANT_AP9,
    email: 'valid.applicant@hospital.org',
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    status: 'pending_approval',
    requestProvenance: 'authenticated_join_request',
    membershipVerified: false
  });

  await test('AP9', 'valid authenticated request with matching UID/email -> ALLOW', async () => {
    const res = await client.post('/api/team/approve-member', 'token_hod_a').send({
      memberId: APPLICANT_AP9
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const updated = await db.collection('team_members').doc(APPLICANT_AP9).get();
    if (updated.data()?.status !== 'active' || updated.data()?.membershipVerified !== true) {
      throw new Error('Target was not marked active and verified');
    }
  });

  // ==========================================
  // RQ: request-join Tests (Real Route)
  // ==========================================
  await test('RQ1', 'Ordinary user requests resident role -> ALLOW, status pending_approval, verified false (200)', async () => {
    const res = await client.post('/api/team/request-join', 'token_applicant').send({
      hospitalId: 'hosp_a_canonical',
      hospitalName: 'Hospital Alpha',
      role: 'resident'
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_APPLICANT.uid).get();
    if (memSnap.data()?.status !== 'pending_approval' || memSnap.data()?.membershipVerified !== false) {
      throw new Error('Record not set to pending_approval / unverified');
    }
  });

  await test('RQ2', 'Applicant requests privileged HOD role -> safely normalized to non-privileged role (200)', async () => {
    const ESCALATOR_UID = 'escalator_uid';
    registerMockToken('token_escalator', { uid: ESCALATOR_UID, email: 'escalator@test.com' });
    const res = await client.post('/api/team/request-join', 'token_escalator').send({
      hospitalId: 'hosp_a_canonical',
      hospitalName: 'Hospital Alpha',
      role: 'HOD / Department Lead' // PRIVILEGE ESCALATION ATTEMPT
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const memSnap = await db.collection('team_members').doc(ESCALATOR_UID).get();
    if (memSnap.data()?.role !== 'resident') {
      throw new Error(`Privilege escalation succeeded! Role is: ${memSnap.data()?.role}`);
    }
  });

  await test('RQ3', 'Applicant requests join with missing hospitalId and hospitalName -> DENY (400)', async () => {
    const res = await client.post('/api/team/request-join', 'token_applicant').send({
      role: 'resident'
      // missing hospitalId and hospitalName
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  await test('RQ4', 'User already having active verified hospital membership calls request-join -> DENY (400)', async () => {
    const res = await client.post('/api/team/request-join', 'token_res_a').send({
      hospitalId: 'hosp_b_canonical',
      hospitalName: 'Hospital Beta',
      role: 'resident'
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // ==========================================
  // AC: accept-invite Tests (Real Route)
  // ==========================================
  await db.collection('team_members').doc(USER_INVITEE.uid).delete();
  const INV_VALID = 'inv_token_valid_123';
  await db.collection('teamInvites').doc(INV_VALID).set({
    id: INV_VALID,
    token: INV_VALID,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByUid: USER_HOD_A.uid
  });

  await test('AC1', 'Valid invite accepted -> atomically creates team_members/{uid} with verified: true, increments usedCount (200)', async () => {
    const res = await client.post('/api/team/accept-invite', 'token_invitee').send({
      token: INV_VALID
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_INVITEE.uid).get();
    if (!memSnap.exists || memSnap.data()?.status !== 'active' || memSnap.data()?.membershipVerified !== true) {
      throw new Error('Membership was not created with active/verified status');
    }
    const invSnap = await db.collection('teamInvites').doc(INV_VALID).get();
    if (invSnap.data()?.usedCount !== 1) {
      throw new Error('usedCount was not incremented');
    }
  });

  const INV_REVOKED = 'inv_token_revoked';
  await db.collection('teamInvites').doc(INV_REVOKED).set({
    id: INV_REVOKED,
    token: INV_REVOKED,
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: true, // REVOKED!
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  });

  await test('AC2', 'Revoked invite accepted -> DENY (400)', async () => {
    const OTHER_UID = 'user_other_1';
    registerMockToken('token_other_1', { uid: OTHER_UID, email: 'other1@gmail.com' });
    const res = await client.post('/api/team/accept-invite', 'token_other_1').send({
      token: INV_REVOKED
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  const INV_EXPIRED = 'inv_token_expired';
  await db.collection('teamInvites').doc(INV_EXPIRED).set({
    id: INV_EXPIRED,
    token: INV_EXPIRED,
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() - 10000).toISOString() // EXPIRED!
  });

  await test('AC3', 'Expired invite accepted -> DENY (400)', async () => {
    const OTHER_UID = 'user_other_2';
    registerMockToken('token_other_2', { uid: OTHER_UID, email: 'other2@gmail.com' });
    const res = await client.post('/api/team/accept-invite', 'token_other_2').send({
      token: INV_EXPIRED
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  const INV_MAX_EXCEEDED = 'inv_token_max_exceeded';
  await db.collection('teamInvites').doc(INV_MAX_EXCEEDED).set({
    id: INV_MAX_EXCEEDED,
    token: INV_MAX_EXCEEDED,
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    maxUses: 2,
    usedCount: 2, // LIMIT REACHED!
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  });

  await test('AC4', 'Max-uses exceeded invite accepted -> DENY (400)', async () => {
    const OTHER_UID = 'user_other_3';
    registerMockToken('token_other_3', { uid: OTHER_UID, email: 'other3@gmail.com' });
    const res = await client.post('/api/team/accept-invite', 'token_other_3').send({
      token: INV_MAX_EXCEEDED
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  const INV_RESTRICTED = 'inv_token_restricted_email';
  await db.collection('teamInvites').doc(INV_RESTRICTED).set({
    id: INV_RESTRICTED,
    token: INV_RESTRICTED,
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    invitedEmail: 'target.only@hospital.org', // RESTRICTED!
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString()
  });

  await test('AC5', 'Restricted email invite accepted by mismatched email -> DENY (400)', async () => {
    const OTHER_UID = 'user_other_4';
    registerMockToken('token_other_4', { uid: OTHER_UID, email: 'mismatched@gmail.com' });
    const res = await client.post('/api/team/accept-invite', 'token_other_4').send({
      token: INV_RESTRICTED
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // ── AC6 to AC11: Platform Admin & Creator Provenance Tests ──
  const USER_AC_APPLICANT = { uid: 'user_ac_applicant', email: 'ac.applicant@gmail.com', name: 'Dr. AC Applicant' };
  registerMockToken('token_ac_applicant', USER_AC_APPLICANT);

  const INV_AC6 = 'inv_ac6_spoofed_platform_admin';
  await db.collection('teamInvites').doc(INV_AC6).set({
    id: INV_AC6,
    token: INV_AC6,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: true,
    createdByUid: USER_RESIDENT_A.uid // USER_RESIDENT_A is NOT varahgrp@gmail.com!
  });

  await test('AC6', 'createdByPlatformAdmin:true but creator UID is not platform admin -> DENY', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC6
    });
    if (res.status !== 400 || !res.body.error?.includes('configured platform admin')) {
      throw new Error(`Expected 400 with platform admin error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const CREATOR_UNVERIFIED_UID = 'creator_unverified_uid';
  await db.collection('team_members').doc(CREATOR_UNVERIFIED_UID).set({
    id: CREATOR_UNVERIFIED_UID,
    uid: CREATOR_UNVERIFIED_UID,
    email: 'unverified.creator@hospital.org',
    hospitalId: 'hosp_a_canonical',
    role: 'hod',
    status: 'active',
    membershipVerified: false // UNVERIFIED!
  });
  const INV_AC7 = 'inv_ac7_creator_unverified';
  await db.collection('teamInvites').doc(INV_AC7).set({
    id: INV_AC7,
    token: INV_AC7,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: false,
    createdByUid: CREATOR_UNVERIFIED_UID
  });

  await test('AC7', 'normal invite creator membershipVerified:false -> DENY', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC7
    });
    if (res.status !== 400 || !res.body.error?.includes('membership is not verified')) {
      throw new Error(`Expected 400 with unverified creator error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const CREATOR_MOVED_UID = 'creator_moved_uid';
  await db.collection('team_members').doc(CREATOR_MOVED_UID).set({
    id: CREATOR_MOVED_UID,
    uid: CREATOR_MOVED_UID,
    email: 'moved.creator@hospital.org',
    hospitalId: 'hosp_b_canonical', // MOVED TO HOSPITAL B!
    role: 'hod',
    status: 'active',
    membershipVerified: true
  });
  const INV_AC8 = 'inv_ac8_creator_moved';
  await db.collection('teamInvites').doc(INV_AC8).set({
    id: INV_AC8,
    token: INV_AC8,
    hospitalId: 'hosp_a_canonical', // INVITE IS FOR HOSPITAL A!
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: false,
    createdByUid: CREATOR_MOVED_UID
  });

  await test('AC8', 'verified creator moved to another hospital -> DENY', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC8
    });
    if (res.status !== 400 || !res.body.error?.includes('does not belong to the invited hospital')) {
      throw new Error(`Expected 400 with creator hospital mismatch error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const CREATOR_INACTIVE_UID = 'creator_inactive_uid';
  await db.collection('team_members').doc(CREATOR_INACTIVE_UID).set({
    id: CREATOR_INACTIVE_UID,
    uid: CREATOR_INACTIVE_UID,
    email: 'inactive.creator@hospital.org',
    hospitalId: 'hosp_a_canonical',
    role: 'hod',
    status: 'inactive', // INACTIVE!
    membershipVerified: true
  });
  const INV_AC9 = 'inv_ac9_creator_inactive';
  await db.collection('teamInvites').doc(INV_AC9).set({
    id: INV_AC9,
    token: INV_AC9,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: false,
    createdByUid: CREATOR_INACTIVE_UID
  });

  await test('AC9', 'creator inactive -> DENY', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC9
    });
    if (res.status !== 400 || !res.body.error?.includes('Invite creator is not active')) {
      throw new Error(`Expected 400 with inactive creator error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  const INV_AC10 = 'inv_ac10_valid_hod';
  await db.collection('teamInvites').doc(INV_AC10).set({
    id: INV_AC10,
    token: INV_AC10,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: false,
    createdByUid: USER_HOD_A.uid // Valid verified same-hospital HOD
  });

  await test('AC10', 'valid verified same-hospital HOD invite -> ALLOW', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC10
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_AC_APPLICANT.uid).get();
    if (!memSnap.exists || memSnap.data()?.status !== 'active' || memSnap.data()?.membershipVerified !== true) {
      throw new Error('Membership was not created with active/verified status');
    }
  });

  const INV_AC11 = 'inv_ac11_valid_platform_admin';
  await db.collection('teamInvites').doc(INV_AC11).set({
    id: INV_AC11,
    token: INV_AC11,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    role: 'resident',
    maxUses: 5,
    usedCount: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdByPlatformAdmin: true,
    createdByUid: USER_PLATFORM_ADMIN.uid // Valid verified platform admin
  });

  await test('AC11', 'valid platform-admin-created invite verified through Firebase Auth UID/email -> ALLOW', async () => {
    await db.collection('team_members').doc(USER_AC_APPLICANT.uid).delete();
    const res = await client.post('/api/team/accept-invite', 'token_ac_applicant').send({
      token: INV_AC11
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_AC_APPLICANT.uid).get();
    if (!memSnap.exists || memSnap.data()?.status !== 'active' || memSnap.data()?.membershipVerified !== true) {
      throw new Error('Membership was not created with active/verified status');
    }
  });

  // ==========================================
  // LHOD: Last-HOD Protection on /leave Tests (Real Route)
  // ==========================================
  await db.collection('team_members').doc(USER_HOD_A2.uid).delete();
  await db.collection('team_members').doc(USER_HOD_INACTIVE.uid).delete();
  await db.collection('team_members').doc(USER_HOD_UNVERIFIED.uid).delete();
  await db.collection('team_members').doc(USER_HOD_A.uid).set({
    id: USER_HOD_A.uid,
    uid: USER_HOD_A.uid,
    email: USER_HOD_A.email,
    name: USER_HOD_A.name,
    hospitalId: 'hosp_a_canonical',
    hospitalName: 'Hospital Alpha',
    hospital: 'Hospital Alpha',
    role: 'HOD / Department Lead',
    status: 'active',
    membershipVerified: true
  });

  await test('LHOD1', 'Sole active verified HOD calls /leave -> DENY (400)', async () => {
    // USER_HOD_A is currently the sole active verified HOD in hosp_a_canonical
    const res = await client.post('/api/team/leave', 'token_hod_a').send({});
    if (res.status !== 400 || !res.body.error?.includes('sole active verified HOD')) {
      throw new Error(`Expected 400 with sole active verified HOD error, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_HOD_A.uid).get();
    if (memSnap.data()?.status !== 'active') {
      throw new Error('Sole HOD status was erroneously modified');
    }
  });

  await test('LHOD3', 'Second HOD exists but is inactive -> DENY (400)', async () => {
    // Add inactive HOD in same hospital
    await db.collection('team_members').doc(USER_HOD_INACTIVE.uid).set({
      id: USER_HOD_INACTIVE.uid,
      uid: USER_HOD_INACTIVE.uid,
      email: USER_HOD_INACTIVE.email,
      hospitalId: 'hosp_a_canonical',
      role: 'HOD / Department Lead',
      status: 'inactive', // INACTIVE!
      membershipVerified: true
    });

    const res = await client.post('/api/team/leave', 'token_hod_a').send({});
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('LHOD4', 'Second HOD exists but is unverified -> DENY (400)', async () => {
    // Add unverified HOD in same hospital
    await db.collection('team_members').doc(USER_HOD_UNVERIFIED.uid).set({
      id: USER_HOD_UNVERIFIED.uid,
      uid: USER_HOD_UNVERIFIED.uid,
      email: USER_HOD_UNVERIFIED.email,
      hospitalId: 'hosp_a_canonical',
      role: 'HOD / Department Lead',
      status: 'active',
      membershipVerified: false // UNVERIFIED!
    });

    const res = await client.post('/api/team/leave', 'token_hod_a').send({});
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('LHOD5', 'Second HOD belongs to another hospital -> DENY (400)', async () => {
    // USER_HOD_B exists in hosp_b_canonical
    const res = await client.post('/api/team/leave', 'token_hod_a').send({});
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('LHOD2', 'Two active verified HODs exist; one leaves -> ALLOW (200)', async () => {
    // Add a genuine second active verified HOD in same hospital
    await db.collection('team_members').doc(USER_HOD_A2.uid).set({
      id: USER_HOD_A2.uid,
      uid: USER_HOD_A2.uid,
      email: USER_HOD_A2.email,
      name: USER_HOD_A2.name,
      hospitalId: 'hosp_a_canonical',
      hospitalName: 'Hospital Alpha',
      role: 'HOD / Department Lead',
      status: 'active',
      membershipVerified: true
    });

    const res = await client.post('/api/team/leave', 'token_hod_a').send({});
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(USER_HOD_A.uid).get();
    if (memSnap.data()?.status !== 'inactive') {
      throw new Error('Leaving HOD status was not set to inactive');
    }
  });

  // Restore USER_HOD_A for subsequent tests
  await db.collection('team_members').doc(USER_HOD_A.uid).update({
    status: 'active'
  });

  // ==========================================
  // ROLE: Exact Admin Role Allowlist Tests (Real Routes)
  // ==========================================
  await test('ROLE1', 'role = "admin_assistant" calling /create-invite -> DENY (403)', async () => {
    const ASSISTANT_UID = 'user_assistant';
    registerMockToken('token_assistant', { uid: ASSISTANT_UID, email: 'assistant@hospital.org' });
    await db.collection('team_members').doc(ASSISTANT_UID).set({
      id: ASSISTANT_UID,
      uid: ASSISTANT_UID,
      email: 'assistant@hospital.org',
      hospitalId: 'hosp_a_canonical',
      role: 'admin_assistant', // Not an exact admin role
      status: 'active',
      membershipVerified: true
    });

    const res = await client.post('/api/team/create-invite', 'token_assistant').send({
      maxUses: 5
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('ROLE2', 'role = "lead_nurse" calling /create-invite -> DENY (403)', async () => {
    const NURSE_UID = 'user_lead_nurse';
    registerMockToken('token_lead_nurse', { uid: NURSE_UID, email: 'nurse@hospital.org' });
    await db.collection('team_members').doc(NURSE_UID).set({
      id: NURSE_UID,
      uid: NURSE_UID,
      email: 'nurse@hospital.org',
      hospitalId: 'hosp_a_canonical',
      role: 'lead_nurse', // Contains "lead", but is NOT an exact admin role
      status: 'active',
      membershipVerified: true
    });

    const res = await client.post('/api/team/create-invite', 'token_lead_nurse').send({
      maxUses: 5
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('ROLE3', 'ordinary role containing "hod" as substring ("hod_trainee") calling /create-invite -> DENY (403)', async () => {
    const TRAINEE_UID = 'user_hod_trainee';
    registerMockToken('token_hod_trainee', { uid: TRAINEE_UID, email: 'trainee@hospital.org' });
    await db.collection('team_members').doc(TRAINEE_UID).set({
      id: TRAINEE_UID,
      uid: TRAINEE_UID,
      email: 'trainee@hospital.org',
      hospitalId: 'hosp_a_canonical',
      role: 'hod_trainee', // Substring contains "hod", but not exact allowlist match
      status: 'active',
      membershipVerified: true
    });

    const res = await client.post('/api/team/create-invite', 'token_hod_trainee').send({
      maxUses: 5
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('ROLE4', 'exact legitimate HOD role ("HOD / Department Lead") calling /create-invite -> ALLOW (200)', async () => {
    const res = await client.post('/api/team/create-invite', 'token_hod_a2').send({
      maxUses: 5
    });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Expected 200 with token, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('ROLE5', 'platform admin (varahgrp@gmail.com) remains separately authorized -> ALLOW (200)', async () => {
    const res = await client.post('/api/team/create-invite', 'token_platform_admin').send({
      maxUses: 5
    });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Expected 200 with token, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  // ── CI1 to CI4: Invite Role Policy Tests ──
  await test('CI1', 'arbitrary "super_admin" -> DENY', async () => {
    const res = await client.post('/api/team/create-invite', 'token_hod_a2').send({
      role: 'super_admin'
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('CI2', '"hod_trainee" -> DENY', async () => {
    const res = await client.post('/api/team/create-invite', 'token_hod_a2').send({
      role: 'hod_trainee'
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('CI3', 'legitimate ordinary role -> ALLOW', async () => {
    const res = await client.post('/api/team/create-invite', 'token_hod_a2').send({
      role: 'resident'
    });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Expected 200 with token, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  await test('CI4', 'exact legitimate HOD role -> result according to documented policy (ALLOW)', async () => {
    const res = await client.post('/api/team/create-invite', 'token_hod_a2').send({
      role: 'HOD / Department Lead'
    });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(`Expected 200 with token, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
  });

  // ==========================================
  // DEC: decline-member Tests (Real Route)
  // ==========================================
  const PENDING_MEMBER_DEC = 'pending_member_dec_uid';
  await db.collection('team_members').doc(PENDING_MEMBER_DEC).set({
    id: PENDING_MEMBER_DEC,
    uid: PENDING_MEMBER_DEC,
    email: 'declining@hospital.org',
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    status: 'pending_approval'
  });

  await test('DEC2', 'Non-HOD attempts to decline member -> DENY (403)', async () => {
    const res = await client.post('/api/team/decline-member', 'token_res_a').send({
      memberId: PENDING_MEMBER_DEC
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}`);
    }
  });

  await test('DEC3', 'Different hospital HOD attempts to decline member -> DENY (403)', async () => {
    const res = await client.post('/api/team/decline-member', 'token_hod_b').send({
      memberId: PENDING_MEMBER_DEC
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}`);
    }
  });

  await test('DEC1', 'Active verified HOD declines pending member in same hospital -> ALLOW (200)', async () => {
    const res = await client.post('/api/team/decline-member', 'token_hod_a2').send({
      memberId: PENDING_MEMBER_DEC
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(PENDING_MEMBER_DEC).get();
    if (memSnap.exists) {
      throw new Error('Pending member document was not deleted');
    }
  });

  // ==========================================
  // RM: remove-member Tests (Real Route)
  // ==========================================
  const REMOVABLE_MEMBER = 'removable_member_uid';
  await db.collection('team_members').doc(REMOVABLE_MEMBER).set({
    id: REMOVABLE_MEMBER,
    uid: REMOVABLE_MEMBER,
    email: 'remove.me@hospital.org',
    hospitalId: 'hosp_a_canonical',
    role: 'resident',
    status: 'active',
    membershipVerified: true
  });

  await test('RM2', 'Non-HOD attempts to remove member -> DENY (400/403)', async () => {
    const res = await client.post('/api/team/remove-member', 'token_res_a').send({
      memberId: REMOVABLE_MEMBER
    });
    if (res.status === 200) {
      throw new Error(`Expected error, got 200: ${JSON.stringify(res.body)}`);
    }
  });

  await test('RM3', 'HOD of different hospital attempts to remove member -> DENY (400/403)', async () => {
    const res = await client.post('/api/team/remove-member', 'token_hod_b').send({
      memberId: REMOVABLE_MEMBER
    });
    if (res.status === 200) {
      throw new Error(`Expected error, got 200: ${JSON.stringify(res.body)}`);
    }
  });

  await test('RM1', 'Active verified HOD removes member in same hospital -> ALLOW (200)', async () => {
    const res = await client.post('/api/team/remove-member', 'token_hod_a2').send({
      memberId: REMOVABLE_MEMBER
    });
    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const memSnap = await db.collection('team_members').doc(REMOVABLE_MEMBER).get();
    if (memSnap.data()?.status !== 'inactive') {
      throw new Error('Member was not marked inactive');
    }
  });

  console.log('========================================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('[FATAL ERROR IN SUITE]', err);
  process.exit(1);
});
