import { MOCK_CANDIDATS } from '../data/mockData';
import { Candidat, Piece } from '../types';

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

const PIECE_RANK: Record<string, number> = {
  absente: 0,
  illisible: 0,
  declaree: 1,
  prouvee: 2,
};

function mergePiecesList(a?: Piece[], b?: Piece[]): Piece[] | undefined {
  if ((!a || a.length === 0) && (!b || b.length === 0)) return a || b;
  const byType = new Map<string, Piece>();
  [...(a || []), ...(b || [])].forEach((p) => {
    if (!p || !p.type) return;
    const key = p.type.toUpperCase();
    const existing = byType.get(key);
    if (!existing) {
      byType.set(key, p);
      return;
    }
    const existingTime = existing.dateMaj ? Date.parse(existing.dateMaj) : 0;
    const nextTime = p.dateMaj ? Date.parse(p.dateMaj) : 0;
    const hasValidExistingTime = !Number.isNaN(existingTime) && existingTime > 0;
    const hasValidNextTime = !Number.isNaN(nextTime) && nextTime > 0;

    if (hasValidNextTime && (!hasValidExistingTime || nextTime > existingTime)) {
      byType.set(key, { ...p });
      return;
    }
    if (hasValidExistingTime && (!hasValidNextTime || existingTime > nextTime)) {
      byType.set(key, { ...existing });
      return;
    }

    const existingRank = PIECE_RANK[existing.statut] ?? 0;
    const nextRank = PIECE_RANK[p.statut] ?? 0;
    const preferNext =
      nextRank > existingRank ||
      (nextRank === existingRank && Boolean(p.fichier && !existing.fichier));
    if (preferNext) {
      byType.set(key, {
        ...existing,
        ...p,
        fichier: p.fichier || existing.fichier,
        fichierVerso: p.fichierVerso || existing.fichierVerso,
      });
    } else {
      byType.set(key, {
        ...p,
        ...existing,
        fichier: existing.fichier || p.fichier,
        fichierVerso: existing.fichierVerso || p.fichierVerso,
      });
    }
  });
  return Array.from(byType.values());
}

/**
 * Fusionne deux enregistrements d'un même candidat sans jamais écraser
 * des candidatures, pièces, coordonnées ou dateEnvoi existants par du vide.
 */
export function mergeCandidateRecords(primary: Candidat, secondary: Partial<Candidat> | null | undefined): Candidat {
  if (!secondary) return primary;
  const primCands = Array.isArray(primary.candidatures) ? primary.candidatures : [];
  const secCands = Array.isArray(secondary.candidatures) ? secondary.candidatures : [];
  const mergedCands = Array.from(new Set([...primCands, ...secCands]));

  const primPanier = Array.isArray(primary.panier) ? primary.panier : [];
  const secPanier = Array.isArray(secondary.panier) ? secondary.panier : [];
  const mergedPanier = Array.from(new Set([...primPanier, ...secPanier])).filter(
    (id) => !mergedCands.includes(id)
  );

  const mergedStatuts = {
    ...(secondary.candidaturesStatuts || {}),
    ...(primary.candidaturesStatuts || {}),
  };
  const mergedHasACorriger = Object.values(mergedStatuts).some((s) => s === 'a_corriger');
  const shouldKeepClearedEnvoi =
    mergedHasACorriger && !primary.dossier?.dateEnvoi && !primary.envoyeLe;
  const clearAnomalies =
    !mergedHasACorriger &&
    (('anomalie' in primary && !primary.anomalie) ||
      Boolean(primary.dossier?.dateEnvoi && Object.keys(mergedStatuts).length > 0));

  const mergedEnvoyeLe = shouldKeepClearedEnvoi
    ? {}
    : {
        ...(secondary.candidaturesEnvoyeLe || {}),
        ...(primary.candidaturesEnvoyeLe || {}),
      };
  const mergedAnomalies = clearAnomalies
    ? {}
    : {
        ...(secondary.candidaturesAnomalies || {}),
        ...(primary.candidaturesAnomalies || {}),
      };

  const mergedDossier =
    primary.dossier || secondary.dossier
      ? {
          ...(secondary.dossier || {}),
          ...(primary.dossier || {}),
          casParticulier: Boolean(primary.dossier?.casParticulier ?? secondary.dossier?.casParticulier),
          guichet: Boolean(primary.dossier?.guichet ?? secondary.dossier?.guichet),
          dateEnvoi: shouldKeepClearedEnvoi
            ? undefined
            : primary.dossier?.dateEnvoi || secondary.dossier?.dateEnvoi,
          motif: primary.dossier?.motif || secondary.dossier?.motif,
          motifAutre: primary.dossier?.motifAutre || secondary.dossier?.motifAutre,
        }
      : undefined;

  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id || `cand-${Date.now()}`,
    nom: primary.nom?.trim() || secondary.nom?.trim() || '',
    nomFamille: primary.nomFamille?.trim() || secondary.nomFamille?.trim() || undefined,
    prenom: primary.prenom?.trim() || secondary.prenom?.trim() || undefined,
    dateNaissance: primary.dateNaissance?.trim() || secondary.dateNaissance?.trim() || undefined,
    cne: primary.cne?.trim() || secondary.cne?.trim() || '',
    cin: primary.cin?.trim() || secondary.cin?.trim() || '',
    email: primary.email?.trim() || secondary.email?.trim() || '',
    tel: primary.tel?.trim() || secondary.tel?.trim() || '',
    motDePasse: primary.motDePasse || secondary.motDePasse,
    compteCree: Boolean(primary.compteCree || secondary.compteCree),
    verificationStatut:
      primary.verificationStatut === 'verifie' || secondary.verificationStatut === 'verifie'
        ? 'verifie'
        : primary.verificationStatut || secondary.verificationStatut,
    panier: mergedPanier,
    panierInteret: mergedPanier,
    candidatures: mergedCands,
    interets: mergedCands,
    candidaturesStatuts: mergedStatuts,
    ...(Object.keys(mergedEnvoyeLe).length > 0
      ? { candidaturesEnvoyeLe: mergedEnvoyeLe }
      : { candidaturesEnvoyeLe: undefined }),
    ...(Object.keys(mergedAnomalies).length > 0
      ? { candidaturesAnomalies: mergedAnomalies }
      : { candidaturesAnomalies: undefined }),
    envoyeLe: shouldKeepClearedEnvoi ? undefined : primary.envoyeLe || secondary.envoyeLe,
    attesteLe: primary.attesteLe || secondary.attesteLe,
    anomalie: clearAnomalies ? undefined : primary.anomalie || secondary.anomalie,
    dossier: mergedDossier,
    pieces: mergePiecesList(primary.pieces, secondary.pieces),
  };
}

function normalizeNameTokens(name?: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .sort()
    .join(' ');
}

function getCandidateFullName(c: Partial<Candidat> | null | undefined): string {
  if (!c) return '';
  const fromParts = [c.prenom, c.nomFamille].filter((v) => v && v.trim()).join(' ').trim();
  return fromParts || c.nom?.trim() || '';
}

function editDistanceLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = tmp;
    }
  }
  return dp[b.length];
}

function emailsFuzzyMatch(emailA: string, emailB: string): boolean {
  const a = emailA.trim().toLowerCase();
  const b = emailB.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const partsA = a.split('@');
  const partsB = b.split('@');
  if (partsA.length !== 2 || partsB.length !== 2) return false;
  if (partsA[1] !== partsB[1]) return false;
  if (partsA[0].length < 5 || partsB[0].length < 5) return false;
  return editDistanceLevenshtein(partsA[0], partsB[0]) <= 1;
}

export function hasMeaningfulCandidateData(c: Partial<Candidat> | null | undefined): boolean {
  if (!c) return false;
  if (Array.isArray(c.candidatures) && c.candidatures.length > 0) return true;
  if (c.dossier?.dateEnvoi || c.envoyeLe) return true;
  if (c.cne?.trim() || c.cin?.trim()) return true;
  if (Array.isArray(c.pieces) && c.pieces.some((p) => p && (p.statut === 'prouvee' || p.statut === 'declaree' || Boolean(p.fichier)))) {
    return true;
  }
  return false;
}

function candidateNameMatchesEmail(cand: Partial<Candidat>, email: string): boolean {
  const fullName = normalizeNameTokens(getCandidateFullName(cand));
  if (!fullName) return false;
  const tokens = fullName.split(' ').filter((t) => t.length >= 3);
  if (tokens.length < 2) return false;
  const localPart = email.trim().toLowerCase().split('@')[0]?.replace(/[^a-z0-9]/g, '') || '';
  if (localPart.length < 5) return false;
  return tokens.every((tok) => {
    if (localPart.includes(tok)) return true;
    // Autoriser 1 faute de frappe sur un nom/prénom >= 5 lettres (ex: chrabi <-> chraibi)
    if (tok.length >= 5) {
      for (let i = 0; i <= localPart.length - (tok.length - 1); i++) {
        for (let len = tok.length - 1; len <= Math.min(tok.length + 1, localPart.length - i); len++) {
          if (editDistanceLevenshtein(localPart.slice(i, i + len), tok) <= 1) return true;
        }
      }
    }
    return false;
  });
}

function readAllStoredCandidateRecords(): Candidat[] {
  if (typeof localStorage === 'undefined') return [];
  const records: Candidat[] = [];
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      Object.values(overrides).forEach((ov) => {
        if (ov && typeof ov === 'object') records.push(ov);
      });
    }
  } catch {}
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        accounts.forEach((a) => {
          if (a && typeof a === 'object') records.push(a);
        });
      }
    }
  } catch {}
  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      if (Array.isArray(all)) {
        all.forEach((c) => {
          if (c && typeof c === 'object') records.push(c);
        });
      }
    }
  } catch {}
  return records;
}

/**
 * Recherche un compte candidat existant pour la connexion (e-mail exact, ou e-mail proche / nom correspondant si mot de passe identique).
 */
export function findExistingCandidateForLogin(cleanEmail: string, cleanPassword?: string): Candidat | null {
  const emailLower = cleanEmail.trim().toLowerCase();
  if (!emailLower) return null;
  const records = readAllStoredCandidateRecords();

  const exact = records.find((r) => r.email?.trim().toLowerCase() === emailLower);
  if (exact) return reconcileCandidateFromStorage(exact);

  if (cleanPassword) {
    const fuzzyEmailMatch = records.find(
      (r) =>
        r.compteCree &&
        r.email &&
        r.motDePasse === cleanPassword &&
        emailsFuzzyMatch(r.email, emailLower)
    );
    if (fuzzyEmailMatch) return reconcileCandidateFromStorage(fuzzyEmailMatch);

    const nameEmailMatch = records.find(
      (r) =>
        r.compteCree &&
        r.motDePasse === cleanPassword &&
        hasMeaningfulCandidateData(r) &&
        candidateNameMatchesEmail(r, emailLower)
    );
    if (nameEmailMatch) return reconcileCandidateFromStorage(nameEmailMatch);
  }

  return null;
}

/**
 * Réconcilie un candidat depuis tous les stockages locaux (registered_accounts, overrides, all_candidates)
 * par ID, e-mail, CNE, CIN, téléphone ou nom complet normalisé, pour éviter toute perte de dossier/candidatures entre les vues.
 */
export function reconcileCandidateFromStorage(base: Candidat): Candidat {
  if (typeof localStorage === 'undefined') return base;
  const cleanId = base.id?.trim();
  const cleanEmail = base.email?.trim().toLowerCase();
  const cleanCne = base.cne?.trim().toUpperCase();
  const cleanCin = base.cin?.trim().toUpperCase();
  const cleanTel = normaliserTel(base.tel);
  const cleanNameKey = normalizeNameTokens(getCandidateFullName(base));
  const baseHasData = hasMeaningfulCandidateData(base);

  const hasConflictingIdentity = (rec: Partial<Candidat>): boolean => {
    const recCne = rec.cne?.trim().toUpperCase();
    const recCin = rec.cin?.trim().toUpperCase();
    if (cleanCne && recCne && cleanCne !== recCne) return true;
    if (cleanCin && recCin && cleanCin !== recCin) return true;
    return false;
  };

  const matchesRecord = (rec: Partial<Candidat> | null | undefined): boolean => {
    if (!rec) return false;
    if (cleanId && cleanId !== 'visiteur-001' && rec.id === cleanId) return true;
    const recEmail = rec.email?.trim().toLowerCase();
    if (cleanEmail && recEmail && recEmail === cleanEmail) return true;
    if (hasConflictingIdentity(rec)) return false;

    const recCne = rec.cne?.trim().toUpperCase();
    if (cleanCne && recCne && cleanCne === recCne) return true;
    const recCin = rec.cin?.trim().toUpperCase();
    if (cleanCin && recCin && cleanCin === recCin) return true;
    const recTel = normaliserTel(rec.tel);
    if (cleanTel && recTel && cleanTel === recTel) return true;

    const recNameKey = normalizeNameTokens(getCandidateFullName(rec));
    if (cleanNameKey && recNameKey && cleanNameKey === recNameKey) {
      if (!cleanEmail || !recEmail || (!baseHasData && hasMeaningfulCandidateData(rec))) {
        return true;
      }
    }

    if (!baseHasData && cleanEmail && hasMeaningfulCandidateData(rec)) {
      if (recEmail && emailsFuzzyMatch(cleanEmail, recEmail)) return true;
      if (candidateNameMatchesEmail(rec, cleanEmail)) return true;
    }

    return false;
  };

  let result: Candidat = { ...base };
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (cleanId && overrides[cleanId]) {
        result = mergeCandidateRecords(overrides[cleanId], result);
      }
      Object.values(overrides).forEach((ov) => {
        if (matchesRecord(ov)) {
          result = mergeCandidateRecords(ov, result);
        }
      });
    }
  } catch {}

  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        accounts.forEach((acc) => {
          if (matchesRecord(acc)) {
            result = mergeCandidateRecords(result, acc);
          }
        });
      }
    }
  } catch {}

  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      if (Array.isArray(all)) {
        all.forEach((c) => {
          if (matchesRecord(c)) {
            result = mergeCandidateRecords(result, c);
          }
        });
      }
    }
  } catch {}

  // Conserver l'ID canonique si trouvé dans overrides/accounts
  if ((!result.id || result.id === 'visiteur-001') && cleanEmail) {
    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      if (rawAccounts) {
        const accounts: Candidat[] = JSON.parse(rawAccounts);
        const match = accounts.find((a) => a.email?.trim().toLowerCase() === cleanEmail);
        if (match?.id) result.id = match.id;
      }
    } catch {}
  }

  return result;
}

/**
 * Enregistre un candidat de façon unifiée dans overrides, registered_accounts et usmba_doctorat_candidat (si actif).
 */
export function persistUnifiedCandidate(cand: Candidat, updateActiveStorage = true): Candidat {
  if (typeof localStorage === 'undefined') return cand;
  const reconciled = reconcileCandidateFromStorage(cand);
  const merged = mergeCandidateRecords(cand, reconciled);

  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    const overrides: Record<string, Candidat> = rawOverrides ? JSON.parse(rawOverrides) : {};
    overrides[merged.id] = merged;
    localStorage.setItem('usmba_candidats_overrides', JSON.stringify(overrides));
  } catch {}

  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
    const cleanEmail = merged.email?.trim().toLowerCase();
    const idx = accounts.findIndex(
      (a) => a.id === merged.id || (cleanEmail && a.email?.trim().toLowerCase() === cleanEmail)
    );
    if (idx !== -1) {
      accounts[idx] = mergeCandidateRecords(merged, accounts[idx]);
      localStorage.setItem('usmba_registered_accounts', JSON.stringify(accounts));
    } else if (merged.compteCree) {
      accounts.push(merged);
      localStorage.setItem('usmba_registered_accounts', JSON.stringify(accounts));
    }
  } catch {}

  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      if (Array.isArray(all)) {
        const cleanEmail = merged.email?.trim().toLowerCase();
        const idxAll = all.findIndex(
          (a) => a.id === merged.id || (cleanEmail && a.email?.trim().toLowerCase() === cleanEmail)
        );
        if (idxAll !== -1) {
          all[idxAll] = mergeCandidateRecords(merged, all[idxAll]);
          localStorage.setItem('usmba_all_candidates', JSON.stringify(all));
        }
      }
    }
  } catch {}

  if (updateActiveStorage) {
    try {
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      const cur: Candidat | null = rawCur ? JSON.parse(rawCur) : null;
      const isSameActive =
        !cur ||
        cur.id === merged.id ||
        cur.id === 'visiteur-001' ||
        (merged.email && cur.email?.trim().toLowerCase() === merged.email.trim().toLowerCase());
      if (isSameActive) {
        localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(merged));
        if (merged.pieces) {
          localStorage.setItem('usmba_doctorat_pieces', JSON.stringify(merged.pieces));
        }
        if (merged.dossier) {
          localStorage.setItem(
            'usmba_doctorat_dossier',
            JSON.stringify({
              candidatId: merged.id,
              casParticulier: Boolean(merged.dossier.casParticulier),
              motif: merged.dossier.motif || '',
              consentementApogee: false,
              statutGlobal: merged.dossier.dateEnvoi ? 'soumis' : 'en_cours',
              dateEnvoi: merged.dossier.dateEnvoi,
            })
          );
        }
      }
    } catch {}
  }

  return merged;
}

/**
 * Retourne tous les identifiants connus associés à un candidat (id + autres entrées partageant son e-mail, CNE, CIN ou nom)
 */
export function getMatchingCandidateIdsForEmail(candidatId?: string, email?: string): Set<string> {
  const ids = new Set<string>();
  if (candidatId) ids.add(candidatId);
  const cleanEmail = email?.trim().toLowerCase();
  if (typeof localStorage === 'undefined') return ids;

  let activeCand: Candidat | null = null;
  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (
        (candidatId && cur.id === candidatId) ||
        (cleanEmail && cur.email?.trim().toLowerCase() === cleanEmail)
      ) {
        activeCand = cur;
      }
    }
  } catch {}

  const activeNameKey = normalizeNameTokens(getCandidateFullName(activeCand));
  const activeCne = activeCand?.cne?.trim().toUpperCase();
  const activeCin = activeCand?.cin?.trim().toUpperCase();

  readAllStoredCandidateRecords().forEach((rec) => {
    if (!rec?.id) return;
    if (candidatId && rec.id === candidatId) {
      ids.add(rec.id);
      return;
    }
    if (cleanEmail && rec.email?.trim().toLowerCase() === cleanEmail) {
      ids.add(rec.id);
      return;
    }
    if (activeCne && rec.cne?.trim().toUpperCase() === activeCne) {
      ids.add(rec.id);
      return;
    }
    if (activeCin && rec.cin?.trim().toUpperCase() === activeCin) {
      ids.add(rec.id);
      return;
    }
    const recNameKey = normalizeNameTokens(getCandidateFullName(rec));
    if (activeNameKey && recNameKey && activeNameKey === recNameKey) {
      ids.add(rec.id);
    }
  });

  return ids;
}

/**
 * Enregistre une notification dans le stockage local et avertit les observateurs
 */
export const ajouterNotification = (notif: {
  destinataireId: string;
  destinataireEmail?: string;
  texte: string;
  type?: 'info' | 'action';
  actionLabel?: string;
  actionTab?: string;
}): void => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('usmba_notifications') : null;
    const list = raw ? JSON.parse(raw) : [];
    const resolvedEmail =
      notif.destinataireEmail?.trim().toLowerCase() ||
      trouverCandidat(notif.destinataireId).email?.trim().toLowerCase() ||
      undefined;
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      destinataireId: notif.destinataireId,
      ...(resolvedEmail ? { destinataireEmail: resolvedEmail } : {}),
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



