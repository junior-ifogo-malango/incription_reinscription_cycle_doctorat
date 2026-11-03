export type UserRole = 'candidat' | 'enseignant' | 'directeur_ced' | 'doctorant';

export type PieceType = 'CIN' | 'DIPLOME' | 'RELEVES' | 'CV' | 'cin' | 'diplome' | 'releves' | 'cv';
export type PieceStatut = 'declaree' | 'prouvee' | 'illisible' | 'absente';
export type PieceSource = 'camera' | 'televersement' | 'apogee';

export type CreneauStatut = 'libre' | 'reserve' | 'confirme';

export interface Sujet {
  id: string;
  titre: string;
  motsCles: string[];
  discipline: string;
  enseignantId: string;
  structure: string; // Ex: Laboratoire LISAC, FST Fès / FS Dhar El Mehraz
  descriptionCourte?: string;
}

export interface Enseignant {
  id: string;
  nom: string;
  email: string;
  etablissement: string;
  structure: string;
}

export interface Piece {
  type: PieceType;
  statut: PieceStatut;
  source?: PieceSource;
  fichier?: string; /* dataURL */
  id?: string;
  candidatId?: string;
  dateMaj?: string;
}

export type MotifCasParticulier = 'ATTESTATION_SANS_DIPLOME' | 'DIPLOME_ETRANGER' | 'INGENIEUR_SANS_LICENCE' | 'AUTRE';

export type CandidatureStatut = 'deposee' | 'retenue';

export interface Candidature {
  id?: string;
  sujetId?: string;
  candidatId?: string;
  statut: CandidatureStatut;
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
  candidatures: string[]; // Max 3 candidatures déposées
  candidaturesStatuts?: Record<string, CandidatureStatut>; // Statut par sujet : 'deposee' | 'retenue'
  compteCree: boolean;
  pieces?: Piece[]; // Stockage : Piece[] (4 éléments) sur le candidat, dans localStorage
  dossier?: {
    casParticulier: boolean;
    motif?: MotifCasParticulier;
    motifAutre?: string;
    guichet: boolean;
  };
  // Aliases pour compatibilité
  panierInteret?: string[];
  interets?: string[];
}

export interface Notification {
  id: string;
  destinataireId: string;
  texte: string;
  date: string; /* ISO */
  lue: boolean;
}

export interface Dossier {
  candidatId: string;
  casParticulier: boolean;
  motif?: string;
  motifAutre?: string;
  consentementApogee: boolean;
  statutGlobal: 'en_cours' | 'soumis' | 'complet' | 'retenu';
  traiterAuGuichet?: boolean;
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
