import { MOCK_CANDIDATS } from '../data/mockData';
import { Candidat } from '../types';

/**
 * Utilitaires pour la génération et l'ouverture de liens de communication (WhatsApp et E-mail).
 * Aucun envoi automatique, aucun serveur : préparation des liens côté client uniquement.
 */

/**
 * Normalise un numéro de téléphone pour WhatsApp :
 * - Enlève espaces, tirets et points
 * - « 0612345678 » devient « 212612345678 »
 * - « +212… » perd le « + »
 * - Renvoie null si le résultat n'a pas 11 à 12 chiffres
 */
export const normaliserTel = (tel: string | undefined | null): string | null => {
  if (!tel) return null;
  let cleaned = tel.replace(/[\s\-.–—_]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '212' + cleaned.slice(1);
  }
  if (!/^\d{11,12}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
};

/**
 * Génère le lien WhatsApp :
 * https://wa.me/{numéro}?text={texte}
 * Renvoie null si le numéro est invalide.
 */
export const lienWhatsApp = (tel: string | undefined | null, texte: string): string | null => {
  const norm = normaliserTel(tel);
  if (!norm) return null;
  return `https://wa.me/${norm}?text=${encodeURIComponent(texte)}`;
};

/**
 * Vérifie si une adresse e-mail a un format acceptable
 */
export const isEmailValide = (email: string | undefined | null): boolean => {
  if (!email) return false;
  const trimmed = email.trim();
  return Boolean(trimmed && trimmed.includes('@') && trimmed.includes('.'));
};

/**
 * Génère le lien mail :
 * mailto:{email}?subject={sujet}&body={texte}
 * Renvoie null si l'email est invalide ou manquant.
 */
export const lienMail = (email: string | undefined | null, sujet: string, texte: string): string | null => {
  if (!isEmailValide(email)) return null;
  const trimmed = email!.trim();
  return `mailto:${trimmed}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texte)}`;
};

/**
 * Ouvre le lien dans un nouvel onglet : window.open(lien, '_blank', 'noopener')
 */
export const ouvrirLien = (lien: string): void => {
  if (typeof window !== 'undefined') {
    window.open(lien, '_blank', 'noopener');
  }
};

function formatDatePourMessage(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [yyyy, mm, dd] = clean.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  return clean;
}

/**
 * Message officiel de convocation à l'entretien
 */
export const messageConvocation = (date: string, heure: string, lieu: string): string => {
  const dateFr = formatDatePourMessage(date);
  return `Vous êtes convoqué(e) à l'entretien le ${dateFr} à ${heure}, lieu : ${lieu}. Confirmez votre présence sur la plateforme.`;
};

/**
 * Message d'annulation de convocation à l'entretien
 */
export const messageConvocationAnnulee = (
  date: string,
  heure: string,
  lieu: string,
  motif: string
): string => {
  const dateFr = formatDatePourMessage(date);
  return `Votre convocation à l'entretien du ${dateFr} à ${heure} (lieu : ${lieu}) a été annulée. Motif : ${motif}.`;
};

/**
 * Message de notification de publication de résultat :
 * Ne contient JAMAIS le résultat, la note ni le motif.
 */
export const messageResultat = (): string => {
  return "Ton résultat est publié. Consulte l'onglet Entretiens de la plateforme.";
};

export const messageAbsenceConstatee = (
  date: string,
  heure: string,
  motif: string
): string => {
  const dateFr = formatDatePourMessage(date);
  return `Votre absence à l'entretien du ${dateFr} à ${heure} a été constatée (motif : ${motif}). Aucune pénalité : vous pouvez être reconvoqué(e) par votre directeur.`;
};

function getNomCompletCandidat(c: Partial<Candidat>): string {
  if (c.nomFamille?.trim() && c.prenom?.trim()) {
    return `${c.prenom.trim()} ${c.nomFamille.trim()}`;
  }
  return c.nom?.trim() || '';
}

/**
 * Recherche les coordonnées complètes du candidat (depuis le stockage ou les données mock)
 */
export const trouverCandidat = (
  candidatId?: string
): { nom: string; tel?: string; email?: string } => {
  if (!candidatId) return { nom: '' };

  let nom = '';
  let tel = '';
  let email = '';
  let matchedCne = '';
  let matchedCin = '';

  const absorbCandidate = (c: Partial<Candidat> | null | undefined, prioritizeEmail = false) => {
    if (!c) return;
    const candidateNom = getNomCompletCandidat(c);
    if (!nom && candidateNom) nom = candidateNom;
    if (!tel && c.tel && c.tel.trim()) tel = c.tel.trim();
    if (!matchedCne && c.cne && c.cne.trim()) matchedCne = c.cne.trim().toUpperCase();
    if (!matchedCin && c.cin && c.cin.trim()) matchedCin = c.cin.trim().toUpperCase();
    if (c.email && c.email.trim()) {
      if (prioritizeEmail || !email) {
        email = c.email.trim();
      }
    }
  };

  let registeredAccounts: Candidat[] = [];
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const parsed = JSON.parse(rawAccounts);
      if (Array.isArray(parsed)) registeredAccounts = parsed;
    }
  } catch {
    // fallback
  }

  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (overrides[candidatId]) {
        absorbCandidate(overrides[candidatId]);
      }
    }
  } catch {
    // fallback
  }

  try {
    const raw = localStorage.getItem('usmba_doctorat_candidat');
    if (raw) {
      const c: Candidat = JSON.parse(raw);
      if (c.id === candidatId || (candidatId === 'visiteur-001' && (c.nom || c.nomFamille))) {
        absorbCandidate(c);
      }
    }
  } catch {
    // fallback
  }

  const accById = registeredAccounts.find((a) => a && a.id === candidatId);
  if (accById) {
    absorbCandidate(accById, true);
  }

  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      const foundAll = all.find((a) => a.id === candidatId);
      if (foundAll) {
        absorbCandidate(foundAll);
      }
    }
  } catch {
    // fallback
  }

  const foundMock = MOCK_CANDIDATS.find((c) => c.id === candidatId);
  if (foundMock) {
    absorbCandidate(foundMock, !email);
  }

  // Si l'e-mail manque encore sur l'ID exact, rechercher dans les comptes inscrits par CNE/CIN
  if (!email && (matchedCne || matchedCin)) {
    const accByIdentity = registeredAccounts.find(
      (a) =>
        a &&
        a.email &&
        a.email.trim() &&
        ((matchedCne && a.cne && a.cne.trim().toUpperCase() === matchedCne) ||
          (matchedCin && a.cin && a.cin.trim().toUpperCase() === matchedCin))
    );
    if (accByIdentity) {
      absorbCandidate(accByIdentity, true);
    }
  }

  try {
    const rawActive = localStorage.getItem('usmba_active_account');
    if (rawActive) {
      const active = JSON.parse(rawActive);
      if (active && active.id === candidatId) {
        if (!nom && active.nom) nom = String(active.nom).trim();
        if (!tel && active.tel) tel = String(active.tel).trim();
        if (!email && active.email) email = String(active.email).trim();
      }
    }
  } catch {
    // fallback
  }

  return {
    nom,
    ...(tel ? { tel } : {}),
    ...(email ? { email } : {}),
  };
};

/**
 * Enregistre une notification dans le stockage local et avertit les observateurs
 */
export const ajouterNotification = (notif: {
  destinataireId: string;
  texte: string;
  type?: 'info' | 'action';
  actionLabel?: string;
  actionTab?: string;
}): void => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('usmba_notifications') : null;
    const list = raw ? JSON.parse(raw) : [];
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      destinataireId: notif.destinataireId,
      texte: notif.texte,
      date: new Date().toISOString(),
      lue: false,
      type: notif.type || 'info',
      ...(notif.actionLabel ? { actionLabel: notif.actionLabel } : {}),
      ...(notif.actionTab ? { actionTab: notif.actionTab } : {}),
    };
    const updated = [newNotif, ...list];
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('usmba_notifications', JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    }
  } catch {}
};

/**
 * Notifie le(s) directeur(s) de thèse lorsqu'un candidat envoie son dossier complet (type 'info')
 */
export const notifierDirecteurDossierEnvoye = (
  directeurIds: string[],
  texte: string
): void => {
  const uniqueIds = Array.from(new Set(directeurIds.filter(Boolean)));
  const targets = uniqueIds.length > 0 ? uniqueIds : ['ens-1'];
  targets.forEach((destinataireId) => {
    ajouterNotification({
      destinataireId,
      texte,
      type: 'info',
    });
  });
};

/**
 * Notifie le(s) directeur(s) de thèse lorsqu'un candidat envoie sa candidature complète (type 'info')
 */
export const notifierDirecteurCandidatureEnvoyee = (
  directeurIds: string[],
  texte: string
): void => {
  notifierDirecteurDossierEnvoye(directeurIds, texte);
};



