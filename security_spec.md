# Security Specification (Phase 0 — Payload-First TDD)

## 1. Data Invariants

1. **Identity Integrity (`users/{userId}`)**:
   - A `UserProfile` document can only be created when `request.auth != null`, `request.auth.token.email_verified == true`, `userId == request.auth.uid`, and `incoming().uid == request.auth.uid`.
   - The `userId` path parameter must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
2. **Privilege Escalation Prevention (Self-Assigned Role Guard)**:
   - On `create` by a non-admin user, `incoming().role` MUST equal `'candidat'`.
   - On `update` by the profile owner (non-admin), `affectedKeys()` MUST be restricted to `['displayName', 'photoURL', 'updatedAt']`; `role`, `uid`, `email`, `authProvider`, and `createdAt` are immutable.
3. **PII Isolation (`users/{userId}`, `candidatures_deposees/{candidatId}`)**:
   - `email`, `tel`, `cin`, `cne` and profile/dossier data can only be read (`get`/`list`) by the owner (`ownerUid == request.auth.uid`) or a verified admin (`isAdmin()` / `isBootstrappedAdmin()`).
4. **Strict Keys & Schema Boundaries**:
   - Only fields declared in `firebase-blueprint.json` are permitted; shadow/ghost fields are rejected via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update.
   - `createdAt` must equal `request.time` on `create` and stay immutable on `update`; `updatedAt` must equal `request.time` on both `create` and `update`.
   - Large base64 file blobs are excluded from Firestore documents; only bounded metadata strings/maps/arrays are stored.
5. **PV Terminal State Locking (`pvs/{pvId}`)**:
   - Once a PV reaches `statut == 'publie'`, non-admin users cannot mutate it.
6. **Admin Registry (`admins/{userId}`)**:
   - Only verified admins (including bootstrapped admins `ifogojunior168@gmail.com` and `nature.hostil@gmail.com` with `email_verified == true`) can create, update, or delete entries in `/admins/{userId}`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Unauthenticated Profile Creation**: Unauthenticated request creating `/users/user_123`.
2. **Unverified Email Spoofing**: Authenticated user with `email_verified: false` attempting to create `/users/user_123` or access admin privileges with `email: 'nature.hostil@gmail.com'`.
3. **Self-Assigned Admin Escalation**: Non-admin user creating `/users/user_123` with `"role": "admin"`.
4. **Cross-User Profile Hijack**: User `user_a` creating or updating `/users/user_b` with `"uid": "user_b"`.
5. **UID Body Spoofing**: User `user_a` creating `/users/user_a` with `"uid": "user_b"`.
6. **Shadow / Ghost Field Injection**: User `user_a` creating `/users/user_a` or `/candidatures_deposees/cand_1` with extra field `"isVerified": true` or `"bypassQuota": true`.
7. **Role Mutation on Owner Update**: Non-admin owner `user_a` updating `/users/user_a` to change `"role": "directeur_ced"`.
8. **Client-Forged Timestamp**: User `user_a` creating `/candidatures_deposees/cand_1` with `"createdAt": "2020-01-01T00:00:00Z"` instead of server `request.time`.
9. **Oversized String/Array Poisoning (DoW)**: User `user_a` setting `nom` to 5,000 characters (`> 160`) or `candidatures` array to > 10 items.
10. **PII Blanket List Scraping**: Non-admin user `user_a` executing an unfiltered `list` query on `/users` or `/candidatures_deposees`.
11. **PV Terminal State Tampering**: Non-admin owner `user_a` modifying a `/pvs/pv_1` document whose `statut` is `'publie'`.
12. **Unauthorized Admin Marker Creation**: Non-admin user `user_a` creating `/admins/user_a`.
