import {
  Candidat,
  Compte,
  UserRole,
  getCompteRoles,
  normaliserRole,
} from '../types';
import { FirebaseUserProfile } from '../firebase';
import {
  INITIAL_ENSEIGNANTS,
  MOCK_CANDIDATS,
  getComptes,
} from '../data/mockData';
import { storageService } from '../services/storage';
import { fr } from '../i18n/fr';

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
    return {
      role: 'candidat',
      email: cleanEmail,
      candidateData: candMatch,
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

  const candidateData: Candidat = existingCandidate
    ? {
        ...existingCandidate,
        nom: existingCandidate.nom || profile.displayName,
        email: cleanEmail,
        compteCree: true,
        verificationStatut: 'verifie',
        panier:
          existingCandidate.panier && existingCandidate.panier.length > 0
            ? existingCandidate.panier
            : existingPanier,
      }
    : {
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
      };

  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
    const filtered = accounts.filter(
      (a) => !a.email || a.email.toLowerCase().trim() !== cleanEmail
    );
    filtered.push(candidateData);
    localStorage.setItem('usmba_registered_accounts', JSON.stringify(filtered));
  } catch {
    // safe fallback
  }

  storageService.setCandidat(candidateData);

  return {
    role: 'candidat',
    email: cleanEmail,
    candidateData,
    compte: {
      id: profile.uid,
      nom: candidateData.nom || profile.displayName,
      email: cleanEmail,
      role: 'candidat',
      roles: ['candidat'],
      structure: fr.auth.googleAccountBadge,
      statut: 'actif',
    },
  };
}
