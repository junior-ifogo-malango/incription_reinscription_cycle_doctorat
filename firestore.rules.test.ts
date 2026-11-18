/**
 * Phase 0 Security Test Specification for firestore.rules
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected (PERMISSION_DENIED)
 * while valid owner and verified-admin operations succeed.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Creation',
    operation: 'create',
    path: '/users/user_123',
    auth: null,
    payload: {
      uid: 'user_123',
      email: 'anon@example.com',
      displayName: 'Anon',
      role: 'candidat',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing as Bootstrapped Admin',
    operation: 'create',
    path: '/users/spoof_uid',
    auth: { uid: 'spoof_uid', email: 'ifogojunior168@gmail.com', email_verified: false },
    payload: {
      uid: 'spoof_uid',
      email: 'ifogojunior168@gmail.com',
      displayName: 'Spoofer',
      role: 'admin',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Role Escalation on Create',
    operation: 'create',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_a',
      email: 'usera@gmail.com',
      displayName: 'User A',
      role: 'admin',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User Profile Creation Hijack',
    operation: 'create',
    path: '/users/user_b',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_b',
      email: 'userb@gmail.com',
      displayName: 'User B',
      role: 'candidat',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'UID Field Spoofing Inside Own Document',
    operation: 'create',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_b',
      email: 'usera@gmail.com',
      displayName: 'User A',
      role: 'candidat',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_a',
      email: 'usera@gmail.com',
      displayName: 'User A',
      role: 'candidat',
      authProvider: 'google',
      isVerifiedAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Role Escalation via Owner Update',
    operation: 'update',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      role: 'directeur_ced',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-Forged Timestamp on Create',
    operation: 'create',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_a',
      email: 'usera@gmail.com',
      displayName: 'User A',
      role: 'candidat',
      authProvider: 'google',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized DisplayName String Poisoning',
    operation: 'create',
    path: '/users/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_a',
      email: 'usera@gmail.com',
      displayName: 'A'.repeat(5000),
      role: 'candidat',
      authProvider: 'google',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'PII Blanket List Scraping on /users',
    operation: 'list',
    path: '/users',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-Admin Reading Another User PII',
    operation: 'get',
    path: '/users/user_b',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Admin Marker Creation',
    operation: 'create',
    path: '/admins/user_a',
    auth: { uid: 'user_a', email: 'usera@gmail.com', email_verified: true },
    payload: {
      uid: 'user_a',
      email: 'usera@gmail.com',
    },
    expected: 'PERMISSION_DENIED',
  },
];
