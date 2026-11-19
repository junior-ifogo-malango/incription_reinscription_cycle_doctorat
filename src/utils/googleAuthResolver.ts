import {
  Candidat,
  Compte,
  UserRole,
  getCompteRoles,
  normaliserRole,
} from '../types';
import { FirebaseUserProfile, isUsmbaEmail } from '../firebase';
import {
  INITIAL_ENSEIGNANTS,
  MOCK_CANDIDATS,
  getComptes,
} from '../data/mockData';
import { storageService } from '../services/storage';
import { fr } from '../i18n/fr';
import {
  hasMeaningfulCandidateData,
  persistUnifiedCandidate,
  reconcileCandidateFromStorage,
} from './messages';

export interface ResolvedGoogleSession {
  role: UserRole;
  email: string;
  candidateData?: Candidat;
  compte?: Compte;
  error?: string;
}

export function resolveGoogleSession(
  profile: FirebaseUserProfile
): ResolvedGoogleSession {
  const cleanEmail = profile.email.trim().toLowerCase();

  // 1. Correspondance dans les comptes gérés (Scolarité / Enseignant / CED / etc.)
  const comptes = getComptes();
  const compteTrouve = comptes.find(
    (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
  );
  if (compteTrouve) {
    if (compteTrouve.statut === 'en_attente' || compteTrouve.statut === 'refuse') {
      return {
        role: 'candidat',
        email: cleanEmail,
        error: fr.auth.accountPendingValidation,
      };
    }
    const roles = getCompteRoles(compteTrouve);
    const primaryRole = normaliserRole(roles[0] || compteTrouve.role || 'candidat');
    return {
      role: primaryRole,
      email: cleanEmail,
      compte: compteTrouve,
    };
  }

  // 2. Correspondance enseignant
  const teacherMatch = INITIAL_ENSEIGNANTS.find(
    (t) => t.email && t.email.toLowerCase().trim() === cleanEmail
  );
  if (teacherMatch) {
    if (teacherMatch.desactive) {
      return {
        role: 'enseignant',
        email: cleanEmail,
        error: fr.auth.accountDeactivated,
      };
    }
    return {
      role: 'enseignant',
      email: cleanEmail,
      compte: {
        id: teacherMatch.id,
        nom: teacherMatch.nom,
        email: cleanEmail,
        role: 'enseignant',
        roles: ['directeur'],
        structure: teacherMatch.structure,
        etablissement: teacherMatch.etablissement,
        statut: 'actif',
        enseignantId: teacherMatch.id,
      },
    };
  }

  // 3. Correspondance candidat de démo
  const candMatch = MOCK_CANDIDATS.find(
    (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
  );
  if (candMatch) {
    if (candMatch.desactive) {
      return {
        role: 'candidat',
        email: cleanEmail,
        error: fr.auth.accountDeactivated,
      };
    }
    let visitorPanier: string[] = [];
    try {
      const cur = storageService.getCandidat();
      if (cur && Array.isArray(cur.panier)) {
        visitorPanier = cur.panier;
      }
    } catch {}
    const mergedPanier = Array.from(
      new Set([...(candMatch.panier || []), ...visitorPanier])
    ).filter((id) => !(candMatch.candidatures || []).includes(id));
    const mergedCandMatch: Candidat = {
      ...candMatch,
      panier: mergedPanier,
      panierInteret: mergedPanier,
    };
    return {
      role: 'candidat',
      email: cleanEmail,
      candidateData: mergedCandMatch,
      compte: {
        id: profile.uid,
        nom: candMatch.nom || profile.displayName,
        email: cleanEmail,
        role: 'candidat',
        roles: ['candidat'],
        structure: 'USMBA Fès',
        statut: 'actif',
      },
    };
  }

  // 4. Rôle non-candidat attribué dans Firestore (/users/{uid})
  if (profile.role && profile.role !== 'candidat') {
    return {
      role: profile.role,
      email: cleanEmail,
      compte: {
        id: profile.uid,
        nom: profile.displayName,
        email: cleanEmail,
        role: profile.role,
        roles: [profile.role],
        structure: 'USMBA Fès',
        statut: 'actif',
      },
    };
  }

  // 5. Utilisateur Google standard -> Candidat (en conservant un éventuel dossier/panier local)
  let existingCandidate: Candidat | null = null;
  let existingPanier: string[] = [];
  try {
    const cur = storageService.getCandidat();
    if (cur && Array.isArray(cur.panier)) {
      existingPanier = cur.panier;
    }
    if (cur && cur.email && cur.email.toLowerCase().trim() === cleanEmail && cur.compteCree) {
      existingCandidate = cur;
    }

    if (!existingCandidate) {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      if (rawAccounts) {
        const accounts: Candidat[] = JSON.parse(rawAccounts);
        const found = accounts.find(
          (a) => a.email && a.email.toLowerCase().trim() === cleanEmail
        );
        if (found) {
          existingCandidate = found;
        }
      }
    }
    if (!existingCandidate) {
      const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
      if (rawOverrides) {
        const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
        const foundOv = Object.values(overrides).find(
          (ov) => ov?.email && ov.email.toLowerCase().trim() === cleanEmail
        );
        if (foundOv) {
          existingCandidate = foundOv;
        }
      }
    }

    if (!existingCandidate) {
      const probed = reconcileCandidateFromStorage({
        id: profile.uid,
        nom: profile.displayName,
        cne: '',
        cin: '',
        email: cleanEmail,
        tel: '',
        panier: [],
        candidatures: [],
        compteCree: true,
      });
      if (hasMeaningfulCandidateData(probed)) {
        existingCandidate = probed;
      }
    }

    if (existingCandidate) {
      existingCandidate = reconcileCandidateFromStorage(existingCandidate);
    }
  } catch {
    // safe fallback
  }

  if (existingCandidate?.desactive) {
    return {
      role: 'candidat',
      email: cleanEmail,
      error: fr.auth.accountDeactivated,
    };
  }

  const mergedExistingPanier = existingCandidate
    ? Array.from(
        new Set([...(existingCandidate.panier || []), ...existingPanier])
      ).filter((id) => !(existingCandidate!.candidatures || []).includes(id))
    : existingPanier;

  const candidateData: Candidat = existingCandidate
    ? {
        ...existingCandidate,
        nom: existingCandidate.nom || profile.displayName,
        email: cleanEmail,
        compteCree: true,
        verificationStatut: 'verifie',
        panier: mergedExistingPanier,
        panierInteret: mergedExistingPanier,
      }
    : reconcileCandidateFromStorage({
        id: profile.uid,
        nom: profile.displayName,
        cne: '',
        cin: '',
        email: cleanEmail,
        tel: '',
        panier: existingPanier,
        panierInteret: existingPanier,
        candidatures: [],
        interets: [],
        compteCree: true,
        verificationStatut: 'verifie',
      });

  const syncedCandidateData = persistUnifiedCandidate(candidateData, true);

  const isInstitutionalUsmba = isUsmbaEmail(cleanEmail);

  return {
    role: 'candidat',
    email: cleanEmail,
    candidateData: syncedCandidateData,
    compte: {
      id: profile.uid,
      nom: syncedCandidateData.nom || profile.displayName,
      email: cleanEmail,
      role: 'candidat',
      roles: ['candidat'],
      structure: isInstitutionalUsmba ? fr.auth.usmbaStructure : fr.auth.googleAccountBadge,
      statut: 'actif',
    },
  };
}
