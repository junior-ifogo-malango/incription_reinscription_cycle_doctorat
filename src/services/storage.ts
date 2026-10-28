import {
  Sujet,
  Enseignant,
  Candidat,
  Piece,
  Dossier,
  Creneau,
  UserRole,
} from '../types';
import {
  INITIAL_SUJETS,
  INITIAL_ENSEIGNANTS,
  INITIAL_CANDIDAT,
  DEMO_CANDIDAT_YASSINE,
  INITIAL_PIECES,
  INITIAL_DOSSIER,
  INITIAL_CRENEAUX,
} from '../data/mockData';

const KEYS = {
  ROLE: 'usmba_doctorat_role',
  SUJETS: 'usmba_doctorat_sujets',
  ENSEIGNANTS: 'usmba_doctorat_enseignants',
  CANDIDAT: 'usmba_doctorat_candidat',
  PIECES: 'usmba_doctorat_pieces',
  DOSSIER: 'usmba_doctorat_dossier',
  CRENEAUX: 'usmba_doctorat_creneaux',
  INITIALIZED: 'usmba_doctorat_initialized_v1',
};

export const storageService = {
  initializeIfNeeded(): void {
    try {
      const isInit = localStorage.getItem(KEYS.INITIALIZED);
      if (!isInit) {
        this.resetToDefaults();
      }
    } catch {
      // In case localStorage is blocked in some environments
    }
  },

  resetToDefaults(): void {
    try {
      localStorage.setItem(KEYS.ROLE, 'candidat');
      localStorage.setItem(KEYS.SUJETS, JSON.stringify(INITIAL_SUJETS));
      localStorage.setItem(KEYS.ENSEIGNANTS, JSON.stringify(INITIAL_ENSEIGNANTS));
      localStorage.setItem(KEYS.CANDIDAT, JSON.stringify(INITIAL_CANDIDAT));
      localStorage.setItem(KEYS.PIECES, JSON.stringify(INITIAL_PIECES));
      localStorage.setItem(KEYS.DOSSIER, JSON.stringify(INITIAL_DOSSIER));
      localStorage.setItem(KEYS.CRENEAUX, JSON.stringify(INITIAL_CRENEAUX));
      localStorage.setItem(KEYS.INITIALIZED, 'true');
    } catch {
      // safe fallback
    }
  },

  getRole(): UserRole {
    try {
      const role = localStorage.getItem(KEYS.ROLE);
      if (role === 'candidat' || role === 'enseignant' || role === 'directeur_ced') {
        return role;
      }
    } catch {
      // fallback
    }
    return 'candidat';
  },

  setRole(role: UserRole): void {
    try {
      localStorage.setItem(KEYS.ROLE, role);
    } catch {
      // fallback
    }
  },

  getSujets(): Sujet[] {
    try {
      const data = localStorage.getItem(KEYS.SUJETS);
      return data ? JSON.parse(data) : INITIAL_SUJETS;
    } catch {
      return INITIAL_SUJETS;
    }
  },

  setSujets(sujets: Sujet[]): void {
    try {
      localStorage.setItem(KEYS.SUJETS, JSON.stringify(sujets));
    } catch {
      // fallback
    }
  },

  getEnseignants(): Enseignant[] {
    try {
      const data = localStorage.getItem(KEYS.ENSEIGNANTS);
      return data ? JSON.parse(data) : INITIAL_ENSEIGNANTS;
    } catch {
      return INITIAL_ENSEIGNANTS;
    }
  },

  getCandidat(): Candidat {
    try {
      const data = localStorage.getItem(KEYS.CANDIDAT);
      if (data) {
        const parsed = JSON.parse(data);
        const panier = Array.isArray(parsed.panier)
          ? parsed.panier
          : (Array.isArray(parsed.panierInteret) ? parsed.panierInteret : []);
        const candidatures = Array.isArray(parsed.candidatures)
          ? parsed.candidatures
          : (Array.isArray(parsed.interets) ? parsed.interets : []);
        return {
          ...INITIAL_CANDIDAT,
          ...parsed,
          panier,
          candidatures,
          panierInteret: panier,
          interets: candidatures,
        };
      }
      return INITIAL_CANDIDAT;
    } catch {
      return INITIAL_CANDIDAT;
    }
  },

  loginAsDemo(): Candidat {
    try {
      localStorage.setItem(KEYS.CANDIDAT, JSON.stringify(DEMO_CANDIDAT_YASSINE));
      return DEMO_CANDIDAT_YASSINE;
    } catch {
      return DEMO_CANDIDAT_YASSINE;
    }
  },

  setCandidat(candidat: Candidat): void {
    try {
      localStorage.setItem(KEYS.CANDIDAT, JSON.stringify(candidat));
    } catch {
      // fallback
    }
  },

  getPieces(): Piece[] {
    try {
      const data = localStorage.getItem(KEYS.PIECES);
      return data ? JSON.parse(data) : INITIAL_PIECES;
    } catch {
      return INITIAL_PIECES;
    }
  },

  setPieces(pieces: Piece[]): void {
    try {
      localStorage.setItem(KEYS.PIECES, JSON.stringify(pieces));
    } catch {
      // fallback
    }
  },

  getDossier(): Dossier {
    try {
      const data = localStorage.getItem(KEYS.DOSSIER);
      return data ? JSON.parse(data) : INITIAL_DOSSIER;
    } catch {
      return INITIAL_DOSSIER;
    }
  },

  setDossier(dossier: Dossier): void {
    try {
      localStorage.setItem(KEYS.DOSSIER, JSON.stringify(dossier));
    } catch {
      // fallback
    }
  },

  getCreneaux(): Creneau[] {
    try {
      const data = localStorage.getItem(KEYS.CRENEAUX);
      return data ? JSON.parse(data) : INITIAL_CRENEAUX;
    } catch {
      return INITIAL_CRENEAUX;
    }
  },

  setCreneaux(creneaux: Creneau[]): void {
    try {
      localStorage.setItem(KEYS.CRENEAUX, JSON.stringify(creneaux));
    } catch {
      // fallback
    }
  },
};
