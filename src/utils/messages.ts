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
 * Génère le lien mail :
 * mailto:{email}?subject={sujet}&body={texte}
 * Renvoie null si l'email est invalide ou manquant.
 */
export const lienMail = (email: string | undefined | null, sujet: string, texte: string): string | null => {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
    return null;
  }
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
