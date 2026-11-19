import { EvenementJournal, UserRole } from '../types';

const STORAGE_KEY = 'gcd_journal';
const MAX_ENTRIES = 500;

export interface ActeurJournal {
  id: string;
  nom: string;
  role: UserRole;
}

export function lireJournal(): EvenementJournal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function logEvent(
  acteur: ActeurJournal,
  action: string,
  cible: string,
  detail?: string
): EvenementJournal | null {
  try {
    const journal = lireJournal();
    const nouvelEvenement: EvenementJournal = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      acteurId: acteur.id || 'system',
      acteurNom: acteur.nom || 'Utilisateur',
      role: acteur.role || 'candidat',
      action,
      cible,
      ...(detail ? { detail } : {}),
    };

    journal.unshift(nouvelEvenement);
    const limite = journal.slice(0, MAX_ENTRIES);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limite));
    } catch {
      // Si localStorage plein, on tronque davantage pour préserver les récents
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limite.slice(0, 100)));
      } catch {
        // En cas d'échec total d'écriture, ne pas planter
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gcd_journal_updated', { detail: nouvelEvenement }));
    }

    return nouvelEvenement;
  } catch {
    return null;
  }
}

export function logCompteCree(
  id: string,
  email: string
): EvenementJournal | null {
  const dateFr = new Date().toLocaleDateString('fr-FR');
  return logEvent(
    { id, nom: email, role: 'candidat' },
    'Compte créé',
    email,
    dateFr
  );
}

export function logDossierEnvoye(
  acteur: ActeurJournal,
  cible: string,
  detail?: string
): EvenementJournal | null {
  return logEvent(
    acteur,
    'Dossier envoyé',
    cible,
    detail
  );
}

export function logCandidatureEnvoyee(
  acteur: ActeurJournal,
  cible: string,
  detail?: string
): EvenementJournal | null {
  return logEvent(
    acteur,
    'Candidature envoyée',
    cible,
    detail
  );
}

export function logConvocationEnvoyee(
  acteur: ActeurJournal,
  candidatNom: string,
  canal: string,
  date: string,
  resultat: string
): EvenementJournal | null {
  return logEvent(
    acteur,
    'Convocation envoyée',
    candidatNom,
    `${canal} • ${date} • ${resultat}`
  );
}

export function logPresenceConstatee(
  acteur: ActeurJournal,
  candidatNom: string,
  date: string
): EvenementJournal | null {
  return logEvent(
    acteur,
    'Présence constatée',
    candidatNom,
    date
  );
}

export function logAbsenceConstatee(
  acteur: ActeurJournal,
  candidatNom: string,
  date: string,
  motif: string
): EvenementJournal | null {
  return logEvent(
    acteur,
    'Absence constatée',
    candidatNom,
    `${date} • Motif : ${motif}`
  );
}
