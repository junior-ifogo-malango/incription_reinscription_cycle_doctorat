export type UserRole = 'candidat' | 'enseignant' | 'directeur_ced' | 'doctorant' | 'agent' | 'admin';

export interface HistoriqueFinPeriode {
  ancienne: string;
  nouvelle: string;
  motif: string;
  modifieLe: string;
  par: string;
}

export interface Periode {
  debut: string;
  fin: string;
  historiqueFin: HistoriqueFinPeriode[];
}

export type CompteStatut = 'actif' | 'en_attente' | 'refuse';

export type Role = UserRole | 'directeur' | 'structure';

export function normaliserRole(role: Role): UserRole {
  if (role === 'directeur') return 'enseignant';
  if (role === 'structure') return 'directeur_ced';
  return role;
}

export interface Compte {
  id: string;
  nom: string;
  email: string;
  motDePasse?: string;
  role?: UserRole;
  roles?: Role[];
  structure: string;
  etablissement?: string;
  statut: CompteStatut;
  motifRefus?: string;
  dateCreation?: string;
  enseignantId?: string;
}

export function getCompteRoles(compte?: Partial<Compte> | null): Role[] {
  if (!compte) return ['candidat'];
  if (Array.isArray(compte.roles) && compte.roles.length > 0) {
    return compte.roles;
  }
  if (compte.role) {
    return [compte.role];
  }
  return ['candidat'];
}

export interface EvenementJournal {
  id: string;
  date: string; /* ISO */
  acteurId: string;
  acteurNom: string;
  role: UserRole;
  action: string;
  cible: string;
  detail?: string;
}

export type GuichetStatut = 'a_contacter' | 'contacte' | 'venu' | 'saisi';

export interface JournalGuichetEntry {
  date: string;
  agent: string;
  action: string;
  note?: string;
}

export type PieceType = 'CIN' | 'DIPLOME' | 'RELEVES' | 'CV' | 'cin' | 'diplome' | 'releves' | 'cv';
export type PieceStatut = 'declaree' | 'prouvee' | 'illisible' | 'absente';
export type PieceSource = 'camera' | 'televersement' | 'apogee';

export type CreneauStatut = 'libre' | 'reserve' | 'confirme';

export const QUOTA_SUJETS = 5;

export interface Sujet {
  id: string;
  titre: string;
  motsCles: string[];
  discipline: string;
  enseignantId: string;
  structure: string; // Ex: Laboratoire LISAC, FST Fès / FS Dhar El Mehraz
  descriptionCourte?: string;
  statut?: 'actif' | 'archive';
}

export interface Enseignant {
  id: string;
  nom: string;
  email: string;
  etablissement: string;
  structure: string;
  role?: UserRole;
  desactive?: boolean;
}

export interface OcrResultatCIN {
  nom: string;
  cin: string;
  confiance: number;
}

export interface Piece {
  type: PieceType;
  statut: PieceStatut;
  source?: PieceSource;
  fichier?: string; /* dataURL */
  id?: string;
  candidatId?: string;
  dateMaj?: string;
  ocrResultat?: OcrResultatCIN;
}

export type MotifCasParticulier = 'ATTESTATION_SANS_DIPLOME' | 'DIPLOME_ETRANGER' | 'INGENIEUR_SANS_LICENCE' | 'AUTRE';

export type CandidatureStatut = 'brouillon' | 'deposee' | 'retenue' | 'a_corriger';

export interface AnomalieCandidature {
  piece: 'CURSUS' | 'CIN' | 'CV';
  nature: 'illisible' | 'absente' | 'incoherente';
  motif: string;
  le: string;
}

export interface Candidature {
  id?: string;
  sujetId?: string;
  candidatId?: string;
  statut: CandidatureStatut;
  attesteLe?: string;
  envoyeLe?: string;
  renvoyeLe?: string;
  anomalie?: AnomalieCandidature;
}

export interface Candidat {
  id: string;
  nom: string;
  cne?: string;
  cin?: string;
  email: string;
  tel: string;
  motDePasse?: string;
  panier: string[]; // Panier illimité
  candidatures: string[]; // Max 3 candidatures
  candidaturesStatuts?: Record<string, CandidatureStatut>; // Statut par sujet : 'brouillon' | 'deposee' | 'retenue' | 'a_corriger'
  candidaturesAnomalies?: Record<string, AnomalieCandidature>;
  candidaturesEnvoyeLe?: Record<string, string>;
  candidaturesRenvoyeLe?: Record<string, string>;
  envoyeLe?: string;
  renvoyeLe?: string;
  anomalie?: AnomalieCandidature;
  compteCree: boolean;
  role?: UserRole;
  desactive?: boolean;
  pieces?: Piece[]; // Stockage : Piece[] (4 éléments) sur le candidat, dans localStorage
  dossier?: {
    casParticulier: boolean;
    motif?: MotifCasParticulier;
    motifAutre?: string;
    guichet: boolean;
    guichetStatut?: GuichetStatut;
    journalGuichet?: JournalGuichetEntry[];
    saisiPar?: string;
    saisiLe?: string;
    consentementGuichet?: boolean;
  };
  // Aliases pour compatibilité
  panierInteret?: string[];
  interets?: string[];
  // Garde-fous anti-fausses candidatures
  verificationStatut?: 'non_verifie' | 'verifie';
  verificationCode?: string;
  verificationEssaisRestants?: number;
  verificationBloqueJusqua?: number; // timestamp en millisecondes
  attesteLe?: string;
  cursus?: {
    diplome?: string;
    etablissement?: string;
    anneeObtention?: number;
    mention?: string;
    [key: string]: any;
  };
}

export type NotificationType = 'info' | 'action';

export interface Notification {
  id: string;
  destinataireId: string;
  texte: string;
  date: string; /* ISO */
  lue: boolean;
  canal?: 'email' | 'sms';
  type?: NotificationType; /* Traité comme 'info' si absent */
  actionLabel?: string;
  actionTab?: string;
}

export interface DossierCompletResult {
  complet: boolean;
  manques: string[];
}

/**
 * Règle d'exhaustivité du dossier candidat :
 * complet si (cursus présent OU casParticulier avec motif) ET CIN et CV au statut 'prouvee'.
 * manques = liste lisible ("Cursus Apogée", "CIN", "CV").
 * Ne plante jamais si candidat, pieces ou cursus undefined.
 */
export function dossierComplet(candidat?: Candidat | null): DossierCompletResult {
  const manques: string[] = [];

  if (!candidat) {
    return { complet: false, manques: ['Cursus Apogée', 'CIN', 'CV'] };
  }

  // 1. Cursus : présent (candidat.cursus ou diplôme vérifié Apogée) OU casParticulier avec motif
  const hasCasParticulier = Boolean(
    candidat.dossier?.casParticulier &&
    Boolean(candidat.dossier?.motif || candidat.dossier?.motifAutre)
  );

  const hasCursus = Boolean(
    candidat.cursus ||
    (Array.isArray(candidat.pieces) &&
      candidat.pieces.some(
        (p) => p && p.type && p.type.toUpperCase() === 'DIPLOME' && p.source === 'apogee' && p.statut === 'prouvee'
      ))
  );

  if (!hasCursus && !hasCasParticulier) {
    manques.push('Cursus Apogée');
  }

  // 2. CIN : statut 'prouvee'
  const pieces = Array.isArray(candidat.pieces) ? candidat.pieces : [];
  const cinPiece = pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
  if (!cinPiece || cinPiece.statut !== 'prouvee') {
    manques.push('CIN');
  }

  // 3. CV : statut 'prouvee'
  const cvPiece = pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CV');
  if (!cvPiece || cvPiece.statut !== 'prouvee') {
    manques.push('CV');
  }

  return {
    complet: manques.length === 0,
    manques,
  };
}

export interface Dossier {
  candidatId: string;
  casParticulier: boolean;
  motif?: string;
  motifAutre?: string;
  consentementApogee: boolean;
  statutGlobal: 'en_cours' | 'soumis' | 'complet' | 'retenu';
  traiterAuGuichet?: boolean;
  guichet?: boolean;
  guichetStatut?: GuichetStatut;
  journalGuichet?: JournalGuichetEntry[];
  saisiPar?: string;
  saisiLe?: string;
  consentementGuichet?: boolean;
}

export interface Creneau {
  id: string;
  enseignantId: string;
  date: string; // YYYY-MM-DD
  heure: string; // HH:MM
  lieu: string; // Salle ou Visioconférence
  candidatId?: string;
  statut: CreneauStatut;
  dateReservation?: string; // ISO string
  dateConfirmation?: string; // ISO string
  relanceLe?: string; // ISO string
}

export interface ApogeeFictifEntry {
  cne: string;
  nom: string;
  cin: string;
  diplome: string;
  mention: string;
  etablissement: string;
  anneeObtention: number;
}

export type ResultatType = 'ADMIS' | 'LISTE_COMPLEMENTAIRE' | 'REFUSE';

export interface Resultat {
  creneauId: string;
  candidatId: string;
  note: number; /* 0 à 20, 1 décimale */
  resultat: ResultatType;
  motif?: string;
  saisiLe: string; /* ISO */
}

export type PVStatut = 'a_signer' | 'signe' | 'original_recu' | 'approuve';

export interface PV {
  id: string;
  directeurId: string;
  date: string; /* AAAA-MM-JJ de la séance */
  resultats: Resultat[]; /* copie figée */
  statut: PVStatut;
  code: string;
  genereLe: string; /* ISO */
  publieLe?: string; /* ISO */
  version?: number;
  remplaceePar?: string; /* id de la version suivante */
  rouvertLe?: string; /* ISO */
  motifReouverture?: string;
  scanDeposeLe?: string;
  scanStatut?: 'en_attente' | 'valide' | 'refuse';
  scanMotifRefus?: string;
}

/* Module R : Réinscription */
export type RapportStatut =
  | 'brouillon'
  | 'soumis'
  | 'valide_encadrant'
  | 'avis_comite'
  | 'a_corriger'
  | 'valide_ced';

export interface Vote {
  membre: string;
  code: string; /* 12 car. aléatoires, crypto.getRandomValues */
  avis?: 'FAVORABLE' | 'DEFAVORABLE';
  commentaire?: string;
  votéLe?: string;
}

export interface Rapport {
  id: string;
  doctorantId: string;
  encadrantId: string;
  annee: 1 | 2 | 3;
  titre: string;
  avancement: string;
  publications: { titre: string; doi?: string }[];
  communications: { titre: string; lieu?: string }[];
  formationsHeures: number;
  perspectives: string;
  aucuneActivite: boolean;
  statut: RapportStatut;
  commentaires: { auteur: string; date: string; texte: string }[];
  comite?: Vote[];
  chronologie: { date: string; acteur: string; action: string }[];
  soumisLe?: string;
  relanceLe?: string;
}

export interface Doctorant {
  id: string;
  nom: string;
  email: string;
  tel?: string;
  annee: 1 | 2 | 3;
  encadrantId: string;
  sujetTitre: string;
  structure: string;
}

export type ProgressionEtapeStatut = 'faite' | 'en_cours' | 'future';

export type EcheanceEtapeCle = 'candidature' | 'dossier' | 'validee' | 'validation' | 'entretien' | 'resultat';

export type EcheancesMap = Partial<Record<EcheanceEtapeCle, string>>;

export interface ProgressionEtapeInfo {
  numero: number;
  cle: 'candidature' | 'dossier' | 'validee' | 'entretien' | 'resultat' | 'inscription';
  nom: string;
  statut: ProgressionEtapeStatut;
  estNonApplicable?: boolean;
  infobulle: string;
  actionTexte?: string;
  echeance?: string;
  enRetard?: boolean;
  joursRetard?: number;
}
