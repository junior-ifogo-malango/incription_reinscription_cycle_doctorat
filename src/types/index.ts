export type UserRole = 'candidat' | 'enseignant' | 'directeur_ced';

export type PieceType = 'cin' | 'diplome' | 'releves' | 'cv';
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

export interface Candidat {
  id: string;
  nom: string;
  cne: string;
  cin: string;
  email: string;
  tel: string;
  panier: string[]; // Panier illimité
  candidatures: string[]; // Max 3 candidatures déposées
  compteCree: boolean;
  // Aliases pour compatibilité
  panierInteret?: string[];
  interets?: string[];
}

export interface Piece {
  id: string;
  candidatId: string;
  type: PieceType;
  statut: PieceStatut;
  fichier?: string; // Nom ou URL/dataURL du fichier
  source: PieceSource;
  dateMaj: string;
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
