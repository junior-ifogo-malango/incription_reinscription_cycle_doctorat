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

/**
 * Message de convocation sur 3 lignes strictes
 */
export const messageConvocation = (date: string, heure: string, lieu: string): string => {
  return `Entretien le ${date} à ${heure}\nLieu : ${lieu}\nÀ faire : confirme ton créneau sur la plateforme`;
};

/**
 * Message de notification de publication de résultat :
 * Ne contient JAMAIS le résultat, la note ni le motif.
 */
export const messageResultat = (): string => {
  return "Ton résultat est publié. Consulte l'onglet Entretiens de la plateforme.";
};

/**
 * Recherche les coordonnées complètes du candidat (depuis le stockage ou les données mock)
 */
export const trouverCandidat = (
  candidatId?: string
): { nom: string; tel?: string; email?: string } => {
  if (!candidatId) return { nom: '' };

  try {
    const raw = localStorage.getItem('usmba_doctorat_candidat');
    if (raw) {
      const c: Candidat = JSON.parse(raw);
      if (c.id === candidatId || (candidatId === 'visiteur-001' && c.nom)) {
        return { nom: c.nom || '', tel: c.tel, email: c.email };
      }
    }
  } catch {
    // fallback
  }

  const found = MOCK_CANDIDATS.find((c) => c.id === candidatId);
  if (found) {
    return { nom: found.nom, tel: found.tel, email: found.email };
  }

  const fallbackNoms: Record<string, string> = {
    'cand-001': 'Yassine El Fassi',
    'cand-sara': 'Sara Benjelloun',
    'cand-omar': 'Omar Idrissi',
    'cand-salma': 'Salma Alami',
    'cand-khadija': 'Khadija Tazi',
  };

  return { nom: fallbackNoms[candidatId] || `Candidat (${candidatId})` };
};
