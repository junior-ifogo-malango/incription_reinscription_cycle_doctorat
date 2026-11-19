import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Candidat, PV } from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
} from '../firebase';
import {
  cleanupSalmaAlamiIfNeeded,
  isSalmaOrAlamiRecord,
} from '../data/mockData';
import { reconcileCandidateFromStorage, trouverCandidat } from './messages';

const ADMIN_EMAILS = new Set(['ifogojunior168@gmail.com', 'nature.hostil@gmail.com']);

function sanitizeFirestoreId(rawId: string, fallbackPrefix: string): string {
  const cleaned = (rawId || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

function isDepositedCandidate(c: Candidat): boolean {
  if (!c) return false;
  if (c.dossier?.dateEnvoi || c.envoyeLe) return true;
  const statuts = Object.values(c.candidaturesStatuts || {});
  return statuts.some((s) => s === 'deposee' || s === 'retenue' || s === 'a_corriger');
}

function collectLocalDepositedCandidates(): Candidat[] {
  if (typeof localStorage === 'undefined') return [];
  const byId = new Map<string, Candidat>();

  const pushCandidate = (raw: Candidat | null | undefined) => {
    if (!raw || !raw.id || raw.id === 'visiteur-001') return;
    const reconciled = reconcileCandidateFromStorage(raw);
    if (isSalmaOrAlamiRecord(reconciled)) return;
    if (!isDepositedCandidate(reconciled)) return;
    byId.set(reconciled.id, reconciled);
  };

  try {
    const rawOv = localStorage.getItem('usmba_candidats_overrides');
    if (rawOv) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOv);
      Object.values(overrides).forEach(pushCandidate);
    }
  } catch {}

  try {
    const rawAcc = localStorage.getItem('usmba_registered_accounts');
    if (rawAcc) {
      const accounts: Candidat[] = JSON.parse(rawAcc);
      if (Array.isArray(accounts)) accounts.forEach(pushCandidate);
    }
  } catch {}

  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      if (Array.isArray(all)) all.forEach(pushCandidate);
    }
  } catch {}

  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      pushCandidate(cur);
    }
  } catch {}

  return Array.from(byId.values());
}

function buildCandidaturePayload(
  cand: Candidat,
  ownerUid: string,
  syncedByEmail: string,
  forUpdate: boolean
): Record<string, unknown> {
  const statutsMap: Record<string, string> = {};
  Object.entries(cand.candidaturesStatuts || {}).forEach(([k, v]) => {
    if (k && v) statutsMap[String(k).slice(0, 64)] = String(v).slice(0, 32);
  });

  const piecesStatuts: Record<string, string> = {};
  (cand.pieces || []).forEach((p) => {
    if (p?.type) {
      piecesStatuts[String(p.type).toUpperCase().slice(0, 32)] = String(p.statut || 'absente').slice(0, 32);
    }
  });

  const statutValues = Object.values(cand.candidaturesStatuts || {});
  const statutDossier: 'brouillon' | 'deposee' | 'retenue' | 'a_corriger' = statutValues.includes('a_corriger')
    ? 'a_corriger'
    : statutValues.includes('retenue')
    ? 'retenue'
    : 'deposee';

  const docId = sanitizeFirestoreId(cand.id, 'cand');
  const displayNom =
    (cand.nom || `${cand.prenom || ''} ${cand.nomFamille || ''}`).trim().slice(0, 160) || docId;

  const base: Record<string, unknown> = {
    nom: displayNom,
    email: (cand.email || '').trim().slice(0, 254),
    candidatures: (cand.candidatures || []).slice(0, 10).map((s) => String(s).slice(0, 64)),
    candidaturesStatuts: statutsMap,
    statutDossier,
    piecesStatuts,
    syncedByEmail: syncedByEmail.slice(0, 254),
    updatedAt: serverTimestamp(),
  };

  if (cand.nomFamille?.trim()) base.nomFamille = cand.nomFamille.trim().slice(0, 100);
  if (cand.prenom?.trim()) base.prenom = cand.prenom.trim().slice(0, 100);
  if (cand.cne?.trim()) base.cne = cand.cne.trim().slice(0, 32);
  if (cand.cin?.trim()) base.cin = cand.cin.trim().slice(0, 32);
  if (cand.tel?.trim()) base.tel = cand.tel.trim().slice(0, 40);
  const sentDate = cand.dossier?.dateEnvoi || cand.envoyeLe;
  if (sentDate?.trim()) base.envoyeLe = sentDate.trim().slice(0, 64);

  if (!forUpdate) {
    base.id = docId;
    base.ownerUid = ownerUid;
    base.createdAt = serverTimestamp();
  }

  return base;
}

function buildPvPayload(pv: PV, ownerUid: string, forUpdate: boolean): Record<string, unknown> {
  const pvDocId = sanitizeFirestoreId(pv.id, 'pv');
  const membres = (pv.membres || [])
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .slice(0, 5)
    .map((m) => m.trim().slice(0, 160));

  const resultats = (pv.resultats || [])
    .filter((r) => !isSalmaOrAlamiRecord({ id: r.candidatId }))
    .slice(0, 50)
    .map((r) => {
      const info = trouverCandidat(r.candidatId);
      return {
        candidatId: String(r.candidatId || '').slice(0, 128),
        candidatNom: String(info.nom || r.candidatId || '').slice(0, 160),
        note: Number(r.note || 0),
        resultat: String(r.resultat || ''),
      };
    });

  const allowedStatuts = ['a_signer', 'signe', 'envoye', 'publie', 'original_recu', 'approuve'];
  const safeStatut = allowedStatuts.includes(pv.statut) ? pv.statut : 'a_signer';
  const sigCount =
    typeof pv.signaturesCount === 'number'
      ? Math.max(0, Math.min(3, pv.signaturesCount))
      : pv.scanStatut === 'valide' || safeStatut === 'signe' || safeStatut === 'envoye' || safeStatut === 'publie'
      ? 3
      : 0;

  const base: Record<string, unknown> = {
    structure: (pv.structure || 'USMBA').trim().slice(0, 200),
    date: (pv.date || new Date().toISOString().slice(0, 10)).trim().slice(0, 32),
    statut: safeStatut,
    signaturesCount: sigCount,
    membres,
    resultats,
    updatedAt: serverTimestamp(),
  };

  if (pv.code?.trim()) base.code = pv.code.trim().slice(0, 64);
  if (pv.scanStatut && ['en_attente', 'valide', 'refuse'].includes(pv.scanStatut)) {
    base.scanStatut = pv.scanStatut;
  }
  if (pv.scanDeposeLe?.trim()) base.scanDeposeLe = pv.scanDeposeLe.trim().slice(0, 64);
  if (pv.envoyeLe?.trim()) base.envoyeLe = pv.envoyeLe.trim().slice(0, 64);
  if (pv.envoyePar?.trim()) base.envoyePar = pv.envoyePar.trim().slice(0, 160);
  if (pv.publieLe?.trim()) base.publieLe = pv.publieLe.trim().slice(0, 64);

  if (!forUpdate) {
    base.id = pvDocId;
    base.ownerUid = ownerUid;
    base.directeurId = (pv.directeurId || 'ens-1').trim().slice(0, 128);
    base.createdAt = serverTimestamp();
  }

  return base;
}

export interface FirebaseSyncSummary {
  candidaturesSynced: number;
  pvsSynced: number;
  removedSalmaAlami: number;
}

async function upsertDocWithRules(
  collectionName: 'candidatures_deposees' | 'pvs',
  docId: string,
  createData: Record<string, unknown>,
  updateData: Record<string, unknown>,
  isAdminUser: boolean,
  skipIfPublished = false
): Promise<boolean> {
  const path = `${collectionName}/${docId}`;
  const ref = doc(db, collectionName, docId);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (snap && snap.exists()) {
    const data = snap.data();
    if (skipIfPublished && data?.statut === 'publie' && !isAdminUser) {
      return false;
    }
    try {
      await updateDoc(ref, updateData);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(ref, createData);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
  return false;
}

export async function syncDepositedToFirestore(
  options: { promptGoogleLoginIfNeeded?: boolean } = {}
): Promise<FirebaseSyncSummary> {
  let user = auth.currentUser;
  if (!user && options.promptGoogleLoginIfNeeded) {
    const res = await signInWithGoogle();
    user = res.user;
  }
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }

  const userEmail = (user.email || '').trim().toLowerCase() || 'google@usmba.ac.ma';
  const isAdminUser = Boolean(user.emailVerified && ADMIN_EMAILS.has(userEmail));

  // 1. Nettoyage local Salma & Alami
  let removedSalmaAlami = cleanupSalmaAlamiIfNeeded(true);

  // 2. Synchroniser toutes les candidatures déposées
  const depositedCandidates = collectLocalDepositedCandidates();
  let candidaturesSynced = 0;
  for (const cand of depositedCandidates) {
    const docId = sanitizeFirestoreId(cand.id, 'cand');
    const createPayload = buildCandidaturePayload(cand, user.uid, userEmail, false);
    const updatePayload = buildCandidaturePayload(cand, user.uid, userEmail, true);
    const ok = await upsertDocWithRules(
      'candidatures_deposees',
      docId,
      createPayload,
      updatePayload,
      isAdminUser
    );
    if (ok) candidaturesSynced += 1;
  }

  // 3. Synchroniser les PV (y compris Aloui)
  let localPvs: PV[] = [];
  try {
    const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
    if (rawPvs) {
      const parsed: PV[] = JSON.parse(rawPvs);
      if (Array.isArray(parsed)) {
        localPvs = parsed.filter((p) => p && !p.remplaceePar);
      }
    }
  } catch {}

  let pvsSynced = 0;
  for (const pv of localPvs) {
    const pvDocId = sanitizeFirestoreId(pv.id, 'pv');
    const createPayload = buildPvPayload(pv, user.uid, false);
    const updatePayload = buildPvPayload(pv, user.uid, true);
    const ok = await upsertDocWithRules(
      'pvs',
      pvDocId,
      createPayload,
      updatePayload,
      isAdminUser,
      true
    );
    if (ok) pvsSynced += 1;
  }

  // 4. Supprimer Salma & Alami dans Firestore (/candidatures_deposees et /users si admin)
  try {
    const candsRef = collection(db, 'candidatures_deposees');
    const candsQuery = isAdminUser ? candsRef : query(candsRef, where('ownerUid', '==', user.uid));
    const candsSnap = await getDocs(candsQuery);
    for (const docSnap of candsSnap.docs) {
      const d = docSnap.data();
      if (
        isSalmaOrAlamiRecord({
          id: docSnap.id,
          nom: String(d.nom || ''),
          prenom: String(d.prenom || ''),
          nomFamille: String(d.nomFamille || ''),
          email: String(d.email || ''),
        })
      ) {
        try {
          await deleteDoc(doc(db, 'candidatures_deposees', docSnap.id));
          removedSalmaAlami += 1;
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `candidatures_deposees/${docSnap.id}`);
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'candidatures_deposees');
  }

  if (isAdminUser) {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const docSnap of usersSnap.docs) {
        if (docSnap.id === user.uid) continue;
        const d = docSnap.data();
        if (
          isSalmaOrAlamiRecord({
            id: docSnap.id,
            displayName: String(d.displayName || ''),
            email: String(d.email || ''),
          })
        ) {
          try {
            await deleteDoc(doc(db, 'users', docSnap.id));
            removedSalmaAlami += 1;
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `users/${docSnap.id}`);
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  }

  return {
    candidaturesSynced,
    pvsSynced,
    removedSalmaAlami,
  };
}

export async function syncPvBestEffort(): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await syncDepositedToFirestore({ promptGoogleLoginIfNeeded: false });
  } catch {
    // Sync silencieux si hors ligne ou règles non encore déployées
  }
}
