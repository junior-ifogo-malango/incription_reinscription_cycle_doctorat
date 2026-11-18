import {
  Sujet,
  Enseignant,
  Candidat,
  Piece,
  Dossier,
  Creneau,
  ApogeeFictifEntry,
  Rapport,
  Doctorant,
  Compte,
  Periode,
  StatutSeance,
  DELAI_PV_JOURS,
  SeanceStatutRecord,
  PV,
} from '../types';

export const INITIAL_ENSEIGNANTS: Enseignant[] = [
  {
    id: 'ens-1',
    nom: 'Pr. Karim El Amrani',
    email: 'directeurthese@gmail.com',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    structure: 'LISAC - FSDM Fès',
    role: 'enseignant',
  },
  {
    id: 'ens-2',
    nom: 'Pr. Amina Bennani',
    email: '',
    etablissement: 'Faculté des Sciences et Techniques (FST Fès)',
    structure: 'Laboratoire Génie Industriel & IA Appliquée',
  },
  {
    id: 'ens-3',
    nom: 'Pr. Mehdi Berrada',
    email: '',
    etablissement: 'Faculté des Sciences Juridiques, Économiques et Sociales (FSJES)',
    structure: 'Laboratoire de Recherche en Économie et Management Durable',
  },
  {
    id: 'ens-4',
    nom: 'Pr. Fatima Chraibi',
    email: '',
    etablissement: 'Faculté de Médecine, de Pharmacie et de Médecine Dentaire',
    structure: 'Laboratoire de Biotechnologie et Pharmacologie Médicale',
  },
  {
    id: 'ens-5',
    nom: 'Pr. Hassan Tahiri',
    email: '',
    etablissement: 'Faculté des Lettres et des Sciences Humaines Saïs',
    structure: 'Laboratoire Patrimoine Fassi et Humanités Numériques',
  },
  {
    id: 'ens-6',
    nom: 'Pr. Zineb Idrissi',
    email: '',
    etablissement: 'École Nationale des Sciences Appliquées (ENSA Fès)',
    structure: 'Laboratoire Énergies Renouvelables et Matériaux Avancés',
  },
];

export const INITIAL_SUJETS: Sujet[] = [
  {
    id: 'suj-01',
    titre: 'Optimisation des Réseaux Électriques Intelligents (Smart Grids) par Réseaux de Neurones Profonds',
    motsCles: ['Smart Grids', 'Deep Learning', 'Énergies Renouvelables', 'Transition Énergétique'],
    discipline: 'Sciences et Techniques de l’Ingénieur',
    enseignantId: 'ens-1',
    structure: 'LISAC - FSDM Fès',
    descriptionCourte: 'Étude prospective de modèles prédictifs pour lisser les pics de charge électrique dans la région Fès-Meknès.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-02',
    titre: 'Vision par Ordinateur pour le Diagnostic Précoce des Maladies Cardiovasculaires en Milieu Hospitalier',
    motsCles: ['Vision par ordinateur', 'Imagerie médicale', 'CHU Fès', 'Deep Learning'],
    discipline: 'Médecine & Biotechnologie',
    enseignantId: 'ens-4',
    structure: 'Biotechnologie et Pharmacologie Médicale - FMP Fès',
    descriptionCourte: 'Développement d’algorithmes de segmentation d’IRM avec le CHU Hassan II de Fès pour une assistance temps réel.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-03',
    titre: 'Régulation Juridique de la Finance Verte et Transition Écologique des PME Marocaines',
    motsCles: ['Finance Verte', 'Droit des Affaires', 'PME', 'ESG Maroc'],
    discipline: 'Droit & Économie',
    enseignantId: 'ens-3',
    structure: 'Économie et Management Durable - FSJES Fès',
    descriptionCourte: 'Analyse comparative du cadre prudentiel bancaire marocain face aux obligations durables européennes et africaines.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-04',
    titre: 'Modélisation Prédictive de la Maintenance Prédictive dans l’Industrie Automobile 4.0',
    motsCles: ['Industrie 4.0', 'IoT Industriel', 'Maintenance Prédictive', 'Capteurs'],
    discipline: 'Sciences et Techniques de l’Ingénieur',
    enseignantId: 'ens-2',
    structure: 'Génie Industriel & IA - FST Fès',
    descriptionCourte: 'Application aux chaînes d’assemblage automobile de la zone franche de Fès Shore.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-05',
    titre: 'Numérisation 3D et Préservation Sémantique des Manuscrits Anciens de la Médina de Fès',
    motsCles: ['Humanités Numériques', 'NLP Arabe', 'Médina de Fès', 'Patrimoine'],
    discipline: 'Lettres & Sciences Humaines',
    enseignantId: 'ens-5',
    structure: 'Patrimoine Fassi et Humanités Numériques - FLSH Saïs',
    descriptionCourte: 'Reconnaissance optique (OCR historique) et catalogage automatisé des documents de la bibliothèque Al Quaraouiyine.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-06',
    titre: 'Matériaux Photovoltaïques Pérovskites à Haut Rendement pour Zones Arides et Fort Ensoleillement',
    motsCles: ['Pérovskite', 'Photovoltaïque', 'Nanomatériaux', 'Zone Aride'],
    discipline: 'Sciences Physiques & Matériaux',
    enseignantId: 'ens-6',
    structure: 'Énergies Renouvelables - ENSA Fès',
    descriptionCourte: 'Synthèse et tests de stabilité thermique sous le climat continental de l’arrière-pays fassi.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-07',
    titre: 'Cybersécurité des Véhicules Connectés et Protocoles d’Authentification Sans Clé V2X',
    motsCles: ['Cybersécurité', 'V2X', 'Véhicules Autonomes', 'Cryptographie'],
    discipline: 'Informatique & Télécoms',
    enseignantId: 'ens-1',
    structure: 'LISAC - FSDM Fès',
    descriptionCourte: 'Sécurisation des échanges sans fil entre véhicules et infrastructures routières avec tolérance aux pannes.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-08',
    titre: 'Impact de la Réforme Fiscale sur la Formalisation du Secteur Informel au Maroc',
    motsCles: ['Fiscalité', 'Secteur Informel', 'Économie Nationale', 'Politique Publique'],
    discipline: 'Droit & Économie',
    enseignantId: 'ens-3',
    structure: 'Économie et Management Durable - FSJES Fès',
    descriptionCourte: 'Mesure économétrique empirique sur les commerçants et artisans de la région Fès-Meknès.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-09',
    titre: 'Valorisation des Déchets Oléicoles (Margines et Grignons) en Biocarburants et Compost Fertilisant',
    motsCles: ['Margines', 'Économie Circulaire', 'Agronomie Durable', 'Biomasse'],
    discipline: 'Biologie & Environnement',
    enseignantId: 'ens-2',
    structure: 'Génie Industriel & Environnement - FST Fès',
    descriptionCourte: 'Dépollution éco-responsable des rejets d’huileries traditionnelles et industrielles autour de Fès et Moulay Yacoub.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-10',
    titre: 'Découverte Automatisée de Molécules Anticancéreuses par Criblage Virtuel et Graphes Moléculaires',
    motsCles: ['GNN', 'Chémo-informatique', 'Oncologie', 'Bio-informatique'],
    discipline: 'Médecine & Biotechnologie',
    enseignantId: 'ens-4',
    structure: 'Biotechnologie et Pharmacologie Médicale - FMP Fès',
    descriptionCourte: 'Utilisation des réseaux de neurones sur graphes pour prédire l’affinité de liaison ligand-récepteur.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-11',
    titre: 'Linguistique Computationnelle et Traduction Automatique du Dialecte Marocain (Darija)',
    motsCles: ['Darija', 'NLP', 'LLM Multilingue', 'Traitement Automatique du Langage'],
    discipline: 'Lettres & Sciences Humaines',
    enseignantId: 'ens-5',
    structure: 'Patrimoine Fassi et Humanités Numériques - FLSH Saïs',
    descriptionCourte: 'Création d’un corpus annoté pour la transcription phonétique et l’analyse sémantique des échanges digitaux.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-12',
    titre: 'Systèmes de Stockage d’Énergie Thermique Haute Température pour Centrales Solaires Thermodynamiques',
    motsCles: ['CSP', 'Sels Fondus', 'Stockage Thermique', 'Noor'],
    discipline: 'Sciences Physiques & Matériaux',
    enseignantId: 'ens-6',
    structure: 'Énergies Renouvelables - ENSA Fès',
    descriptionCourte: 'Optimisation des matériaux de confinement pour supporter les cycles thermiques extrêmes.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-13',
    titre: 'Gouvernance Décentralisée et Smart Contracts pour la Traçabilité de l’Artisanat Traditionnel',
    motsCles: ['Blockchain', 'Artisanat', 'Smart Contracts', 'Traçabilité'],
    discipline: 'Informatique & Télécoms',
    enseignantId: 'ens-1',
    structure: 'LISAC - FSDM Fès',
    descriptionCourte: 'Label numérique certifié sur blockchain pour la céramique et la dinanderie authentiques de Fès.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-14',
    titre: 'Bio-surveillance Épidémiologique des Bactéries Multirésistantes aux Antibiotiques en Eaux Usées',
    motsCles: ['Santé Publique', 'Résistance Antibiotiques', 'One Health', 'Microbiologie'],
    discipline: 'Médecine & Biotechnologie',
    enseignantId: 'ens-4',
    structure: 'Biotechnologie Médicale - FMP Fès',
    descriptionCourte: 'Suivi génomique des eaux urbaines de l’Oued Sebou pour anticiper les foyers infectieux.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
  {
    id: 'suj-15',
    titre: 'Résilience Logistique des Chaînes d’Approvisionnement Agroalimentaires face au Stress Hydrique',
    motsCles: ['Supply Chain', 'Stress Hydrique', 'Agro-business', 'Résilience'],
    discipline: 'Droit & Économie',
    enseignantId: 'ens-3',
    structure: 'Économie et Management Durable - FSJES Fès',
    descriptionCourte: 'Stratégies d’atténuation des risques d’approvisionnement des cultures céréalières et maraîchères de la plaine du Saïs.',
    statutValidation: 'publie',
    dateValidation: '2026-10-15',
  },
];

export const INITIAL_PIECES_YASSINE: Piece[] = [
  {
    type: 'CIN',
    statut: 'absente',
  },
  {
    type: 'DIPLOME',
    statut: 'absente',
  },
  {
    type: 'RELEVES',
    statut: 'absente',
  },
  {
    type: 'CV',
    statut: 'absente',
  },
];

export const INITIAL_CANDIDAT: Candidat = {
  id: 'visiteur-001',
  nom: '',
  cne: '',
  cin: '',
  email: '',
  tel: '',
  panier: [],
  candidatures: [],
  candidaturesStatuts: {},
  compteCree: false,
  dossier: {
    casParticulier: false,
    guichet: false,
  },
  pieces: [
    { type: 'CIN', statut: 'absente' },
    { type: 'DIPLOME', statut: 'absente' },
    { type: 'RELEVES', statut: 'absente' },
    { type: 'CV', statut: 'absente' },
  ],
};

export const DEMO_CANDIDAT_YASSINE: Candidat = {
  id: 'cand-etudiant',
  nom: '',
  cne: '',
  cin: '',
  email: 'etudiant@gmail.com',
  motDePasse: '1234',
  role: 'candidat',
  tel: '',
  panier: [],
  panierInteret: [],
  candidatures: [],
  interets: [],
  candidaturesStatuts: {},
  compteCree: true,
  verificationStatut: 'verifie',
  dossier: {
    casParticulier: false,
    guichet: false,
  },
  pieces: INITIAL_PIECES_YASSINE,
};

export const INITIAL_PIECES: Piece[] = [];

export const INITIAL_DOSSIER: Dossier = {
  candidatId: 'cand-etudiant',
  casParticulier: false,
  motif: '',
  consentementApogee: false,
  statutGlobal: 'en_cours',
};

export const DEMO_AGENT_KARIMA = {
  id: 'agent-001',
  nom: 'Karima Tazi',
  email: '',
  role: 'agent' as const,
};

export const MOCK_CANDIDATS: Candidat[] = [DEMO_CANDIDAT_YASSINE];

export const INITIAL_CRENEAUX: Creneau[] = [];

export const ApogeeFictif: Record<string, string> = {
  'N138249871': 'Master en Informatique, USMBA 2023',
  'N145678902': 'Licence en Physique, USMBA 2022',
};

export const APOGEE_FICTIF_DB: Record<string, ApogeeFictifEntry> = {
  N138249871: {
    cne: 'N138249871',
    nom: 'Yassine El Fassi',
    cin: 'CD789123',
    diplome: 'Master Recherche en Systèmes Intelligents et Réseaux',
    mention: 'Très Bien',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM Fès)',
    anneeObtention: 2026,
  },
  N149021873: {
    cne: 'N149021873',
    nom: 'Salma Alami',
    cin: 'CD654321',
    diplome: 'Master en Biotechnologie Appliquée à la Santé',
    mention: 'Bien',
    etablissement: 'Faculté de Médecine et de Pharmacie de Fès',
    anneeObtention: 2025,
  },
  M130098452: {
    cne: 'M130098452',
    nom: 'Othmane Benchekroun',
    cin: 'CD987654',
    diplome: 'Master en Économie Appliquée et Développement Territorial',
    mention: 'Très Bien',
    etablissement: 'FSJES Fès',
    anneeObtention: 2026,
  },
  M142078911: {
    cne: 'M142078911',
    nom: 'Khadija Tazi',
    cin: 'CD321987',
    diplome: 'Diplôme d’Ingénieur d’État en Énergies Renouvelables',
    mention: 'Très Bien',
    etablissement: 'ENSA Fès',
    anneeObtention: 2026,
  },
};

/* ========================================================================= */
/* MODULE R : RÉINSCRIPTION - DONNÉES DE DÉMONSTRATION                       */
/* ========================================================================= */

export const DEMO_DOCTORANT_NADIA: Doctorant = {
  id: 'doc-nadia',
  nom: 'Nadia Alaoui',
  email: '',
  tel: '',
  annee: 2,
  encadrantId: 'ens-1',
  sujetTitre: 'Intelligence Artificielle Distribuée pour l’Optimisation Énergétique des Bâtiments Intelligents',
  structure: 'Laboratoire LISAC - Faculté des Sciences Dhar El Mehraz (FSDM)',
};

export const INITIAL_RAPPORTS: Rapport[] = [];

/* ========================================================================= */
/* ÉCHÉANCES ET DATE DE DÉMO (PARCOURS CANDIDAT)                             */
/* ========================================================================= */

export const ECHEANCES: Record<string, string> = {
  candidature: '2026-11-10',
  dossier: '2026-11-11',
  validee: '2026-11-12',
  validation: '2026-11-12',
  entretien: '2026-11-20',
  resultat: '2026-11-30',
};

export const DEMO_DATE_STORAGE_KEY = 'usmba_demo_date';

/**
 * Renvoie la "date de démo" si elle existe en localStorage, sinon la vraie date.
 * Format : AAAA-MM-JJ
 */
export function aujourdhui(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const demoDate = localStorage.getItem(DEMO_DATE_STORAGE_KEY);
      if (demoDate && /^\d{4}-\d{2}-\d{2}$/.test(demoDate.trim())) {
        return demoDate.trim();
      }
    }
  } catch {
    // safe fallback
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const PERIODE_CANDIDATURE_STORAGE_KEY = 'usmba_periode_candidature';

export const PERIODE_CANDIDATURE_DEFAUT: Periode = {
  debut: '2026-07-01',
  fin: '2026-09-09',
  historiqueFin: [],
};

export function getPeriodeCandidature(): Periode {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PERIODE_CANDIDATURE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.debut === 'string' && typeof parsed.fin === 'string') {
          return {
            debut: parsed.debut,
            fin: parsed.fin,
            historiqueFin: Array.isArray(parsed.historiqueFin) ? parsed.historiqueFin : [],
          };
        }
      }
    }
  } catch {
    // safe fallback
  }
  return PERIODE_CANDIDATURE_DEFAUT;
}

export function savePeriodeCandidature(periode: Periode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PERIODE_CANDIDATURE_STORAGE_KEY, JSON.stringify(periode));
      window.dispatchEvent(new CustomEvent('usmba_periode_updated', { detail: periode }));
      window.dispatchEvent(new CustomEvent('storage'));
    }
  } catch {
    // safe fallback
  }
}


/* ========================================================================= */
/* COMPTES UTILISATEURS ET VALIDATION SCOLARITÉ                              */
/* ========================================================================= */

export const INITIAL_COMPTES: Compte[] = [
  {
    id: 'cpt-admin-1',
    nom: 'Service Scolarité',
    email: 'admin@gmail.com',
    motDePasse: '1234',
    role: 'admin',
    structure: 'Présidence USMBA - Pôle Scolarité & Doctorat',
    etablissement: 'Université Sidi Mohamed Ben Abdellah',
    statut: 'actif',
    dateCreation: '2026-10-01',
  },
  {
    id: 'ens-1',
    nom: 'Pr. Karim El Amrani',
    email: 'directeurthese@gmail.com',
    motDePasse: '1234',
    role: 'enseignant',
    roles: ['directeur'],
    structure: 'LISAC - FSDM Fès',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    statut: 'actif',
    dateCreation: '2026-10-01',
    enseignantId: 'ens-1',
  },
  {
    id: 'ced',
    nom: 'Directeur de structure',
    email: 'directeurstructure@gmail.com',
    motDePasse: '1234',
    role: 'directeur_ced',
    roles: ['structure'],
    structure: 'LISAC - FSDM Fès',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    statut: 'actif',
    dateCreation: '2026-10-01',
  },
];

export const STORAGE_KEY_COMPTES = 'gcd_comptes';
const MIGRATION_4COMPTES_KEY = 'usmba_migration_4comptes_v1';
const CLEANUP_ALAOUI_TARIQ_KEY = 'usmba_cleanup_alaoui_tariq_v1';

export function migrateTestAccountsIfNeeded(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(MIGRATION_4COMPTES_KEY)) return;

    localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(INITIAL_COMPTES));
    localStorage.setItem('usmba_doctorat_enseignants', JSON.stringify(INITIAL_ENSEIGNANTS));
    localStorage.setItem('usmba_registered_accounts', JSON.stringify([]));
    localStorage.setItem('usmba_candidats_overrides', JSON.stringify({}));
    localStorage.setItem('usmba_all_candidates', JSON.stringify([]));
    localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(INITIAL_CANDIDAT));
    localStorage.setItem('usmba_doctorat_pieces', JSON.stringify(INITIAL_PIECES));
    localStorage.setItem('usmba_doctorat_dossier', JSON.stringify(INITIAL_DOSSIER));
    localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify([]));
    localStorage.setItem('usmba_doctorat_pvs', JSON.stringify([]));
    localStorage.setItem('usmba_doctorat_resultats', JSON.stringify([]));
    localStorage.setItem('usmba_seances_statuts', JSON.stringify({}));
    localStorage.setItem('usmba_commission_pv_downloaded', JSON.stringify({}));
    localStorage.setItem('usmba_commission_seance_membres', JSON.stringify({}));
    localStorage.setItem('usmba_notifications', JSON.stringify([]));
    localStorage.setItem('usmba_doctorat_rapports', JSON.stringify([]));
    localStorage.setItem('usmba_rapports', JSON.stringify([]));
    localStorage.setItem('usmba_doctorat_role', 'candidat');
    localStorage.removeItem('usmba_active_account');
    localStorage.setItem(MIGRATION_4COMPTES_KEY, 'true');
  } catch {
    // safe fallback
  }
}

export function cleanupAlaouiTariqIfNeeded(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(CLEANUP_ALAOUI_TARIQ_KEY)) return;

    const TARGET_EMAIL = 'alaouitariq@gmail.com';
    const isTargetMatch = (c: Partial<Candidat> | null | undefined): boolean => {
      if (!c) return false;
      const email = (c.email || '').trim().toLowerCase();
      if (email === TARGET_EMAIL) return true;
      const fullNom = `${c.nom || ''} ${c.prenom || ''} ${c.nomFamille || ''}`.toLowerCase();
      return fullNom.includes('alaoui') && fullNom.includes('tariq');
    };

    const buildEmptyAccount = (acc: Candidat): Candidat => ({
      id: acc.id,
      nom: '',
      email: acc.email || TARGET_EMAIL,
      tel: '',
      ...(acc.motDePasse ? { motDePasse: acc.motDePasse } : {}),
      role: 'candidat',
      compteCree: true,
      verificationStatut: acc.verificationStatut || 'verifie',
      panier: [],
      panierInteret: [],
      candidatures: [],
      interets: [],
      candidaturesStatuts: {},
      dossier: { casParticulier: false, guichet: false },
      pieces: INITIAL_PIECES_YASSINE.map((p) => ({ type: p.type, statut: 'absente' as const })),
    });

    const targetIds = new Set<string>();

    // 1. Registered accounts (keep account with empty profile)
    try {
      const rawAcc = localStorage.getItem('usmba_registered_accounts');
      if (rawAcc) {
        const accounts: Candidat[] = JSON.parse(rawAcc);
        if (Array.isArray(accounts)) {
          let changed = false;
          const nextAcc = accounts.map((acc) => {
            if (isTargetMatch(acc)) {
              if (acc.id) targetIds.add(acc.id);
              changed = true;
              return buildEmptyAccount(acc);
            }
            return acc;
          });
          if (changed) {
            localStorage.setItem('usmba_registered_accounts', JSON.stringify(nextAcc));
          }
        }
      }
    } catch {}

    // 2. Collect any matching IDs from other candidate stores
    try {
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (isTargetMatch(cur) && cur.id) targetIds.add(cur.id);
      }
    } catch {}

    try {
      const rawAct = localStorage.getItem('usmba_active_account');
      if (rawAct) {
        const act: Candidat = JSON.parse(rawAct);
        if (isTargetMatch(act) && act.id) targetIds.add(act.id);
      }
    } catch {}

    try {
      const rawOv = localStorage.getItem('usmba_candidats_overrides');
      if (rawOv) {
        const overrides: Record<string, Candidat> = JSON.parse(rawOv);
        Object.entries(overrides).forEach(([k, v]) => {
          if (isTargetMatch(v)) targetIds.add(v.id || k);
        });
      }
    } catch {}

    try {
      const rawAll = localStorage.getItem('usmba_all_candidates');
      if (rawAll) {
        const all: Candidat[] = JSON.parse(rawAll);
        if (Array.isArray(all)) {
          all.forEach((c) => {
            if (isTargetMatch(c) && c.id) targetIds.add(c.id);
          });
        }
      }
    } catch {}

    // 3. Reset current candidate / active account / dossier / pieces if matching
    try {
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (isTargetMatch(cur) || (cur.id && targetIds.has(cur.id))) {
          const emptyCur = buildEmptyAccount(cur);
          localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(emptyCur));
          localStorage.setItem('usmba_doctorat_pieces', JSON.stringify([]));
          localStorage.setItem(
            'usmba_doctorat_dossier',
            JSON.stringify({
              candidatId: emptyCur.id,
              casParticulier: false,
              motif: '',
              consentementApogee: false,
              statutGlobal: 'en_cours',
            })
          );
        }
      }
    } catch {}

    try {
      const rawAct = localStorage.getItem('usmba_active_account');
      if (rawAct) {
        const act: Candidat = JSON.parse(rawAct);
        if (isTargetMatch(act) || (act.id && targetIds.has(act.id))) {
          localStorage.setItem('usmba_active_account', JSON.stringify(buildEmptyAccount(act)));
        }
      }
    } catch {}

    try {
      const rawDossier = localStorage.getItem('usmba_doctorat_dossier');
      if (rawDossier) {
        const dos: Dossier = JSON.parse(rawDossier);
        if (dos.candidatId && targetIds.has(dos.candidatId)) {
          localStorage.setItem(
            'usmba_doctorat_dossier',
            JSON.stringify({
              candidatId: dos.candidatId,
              casParticulier: false,
              motif: '',
              consentementApogee: false,
              statutGlobal: 'en_cours',
            })
          );
          localStorage.setItem('usmba_doctorat_pieces', JSON.stringify([]));
        }
      }
    } catch {}

    // 4. Remove overrides, all_candidates, simulated_statuts
    try {
      const rawOv = localStorage.getItem('usmba_candidats_overrides');
      if (rawOv) {
        const overrides: Record<string, Candidat> = JSON.parse(rawOv);
        let changed = false;
        Object.keys(overrides).forEach((k) => {
          if (targetIds.has(k) || isTargetMatch(overrides[k])) {
            delete overrides[k];
            changed = true;
          }
        });
        if (changed) localStorage.setItem('usmba_candidats_overrides', JSON.stringify(overrides));
      }
    } catch {}

    try {
      const rawAll = localStorage.getItem('usmba_all_candidates');
      if (rawAll) {
        const all: Candidat[] = JSON.parse(rawAll);
        if (Array.isArray(all)) {
          const nextAll = all.filter((c) => !(c.id && targetIds.has(c.id)) && !isTargetMatch(c));
          if (nextAll.length !== all.length) {
            localStorage.setItem('usmba_all_candidates', JSON.stringify(nextAll));
          }
        }
      }
    } catch {}

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      if (rawSim) {
        const sim: Record<string, string> = JSON.parse(rawSim);
        let changed = false;
        Object.keys(sim).forEach((k) => {
          if (Array.from(targetIds).some((id) => k.startsWith(`${id}-`))) {
            delete sim[k];
            changed = true;
          }
        });
        if (changed) localStorage.setItem('usmba_simulated_statuts', JSON.stringify(sim));
      }
    } catch {}

    // 5. Remove convocations/creneaux, results, and empty sessions
    const removedCreneauIds = new Set<string>();
    const affectedSessions = new Set<string>();
    const affectedDates = new Set<string>();
    let remainingCreneaux: Creneau[] = [];

    try {
      const rawCr = localStorage.getItem('usmba_doctorat_creneaux');
      if (rawCr) {
        const crList: Creneau[] = JSON.parse(rawCr);
        if (Array.isArray(crList)) {
          remainingCreneaux = crList.filter((c) => {
            if (c.candidatId && targetIds.has(c.candidatId)) {
              if (c.id) removedCreneauIds.add(c.id);
              if (c.enseignantId && c.date) affectedSessions.add(`${c.enseignantId}_${c.date}`);
              if (c.date) affectedDates.add(c.date);
              return false;
            }
            return true;
          });
          if (remainingCreneaux.length !== crList.length) {
            localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify(remainingCreneaux));
          }
        }
      }
    } catch {}

    try {
      const rawRes = localStorage.getItem('usmba_doctorat_resultats');
      if (rawRes) {
        const resList: import('../types').Resultat[] = JSON.parse(rawRes);
        if (Array.isArray(resList)) {
          const nextRes = resList.filter(
            (r) => !(r.candidatId && targetIds.has(r.candidatId)) && !(r.creneauId && removedCreneauIds.has(r.creneauId))
          );
          if (nextRes.length !== resList.length) {
            localStorage.setItem('usmba_doctorat_resultats', JSON.stringify(nextRes));
          }
        }
      }
    } catch {}

    let remainingPvs: PV[] = [];
    const removedPvIds = new Set<string>();
    try {
      const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
      if (rawPvs) {
        const pvsList: PV[] = JSON.parse(rawPvs);
        if (Array.isArray(pvsList)) {
          let changed = false;
          remainingPvs = pvsList
            .map((pv) => {
              const filteredRes = (pv.resultats || []).filter(
                (r) => !(r.candidatId && targetIds.has(r.candidatId)) && !(r.creneauId && removedCreneauIds.has(r.creneauId))
              );
              if (filteredRes.length !== (pv.resultats || []).length) {
                changed = true;
                if (pv.directeurId && pv.date) affectedSessions.add(`${pv.directeurId}_${pv.date}`);
                if (pv.date) affectedDates.add(pv.date);
                return { ...pv, resultats: filteredRes };
              }
              return pv;
            })
            .filter((pv) => {
              const hasSlotsForSession = remainingCreneaux.some(
                (c) => c.enseignantId === pv.directeurId && c.date === pv.date && Boolean(c.candidatId)
              );
              if ((pv.resultats || []).length === 0 && !hasSlotsForSession) {
                if (pv.id) removedPvIds.add(pv.id);
                changed = true;
                return false;
              }
              return true;
            });
          if (changed) {
            localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(remainingPvs));
          }
        }
      }
    } catch {}

    // Delete empty session metadata
    if (affectedSessions.size > 0) {
      try {
        const rawStat = localStorage.getItem(SEANCES_STATUTS_STORAGE_KEY);
        if (rawStat) {
          const statMap: Record<string, SeanceStatutRecord> = JSON.parse(rawStat);
          let changed = false;
          affectedSessions.forEach((key) => {
            const [ensId, ...dateParts] = key.split('_');
            const dt = dateParts.join('_');
            const hasSlots = remainingCreneaux.some(
              (c) => c.enseignantId === ensId && c.date === dt && Boolean(c.candidatId)
            );
            const hasPvs = remainingPvs.some((p) => p.directeurId === ensId && p.date === dt);
            if (!hasSlots && !hasPvs && statMap[key]) {
              delete statMap[key];
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem(SEANCES_STATUTS_STORAGE_KEY, JSON.stringify(statMap));
          }
        }
      } catch {}
    }

    if (affectedDates.size > 0) {
      try {
        const rawMem = localStorage.getItem('usmba_commission_seance_membres');
        if (rawMem) {
          const memMap = JSON.parse(rawMem);
          let changed = false;
          affectedDates.forEach((dt) => {
            const hasSlots = remainingCreneaux.some((c) => c.date === dt && Boolean(c.candidatId));
            const hasPvs = remainingPvs.some((p) => p.date === dt);
            if (!hasSlots && !hasPvs && memMap[dt]) {
              delete memMap[dt];
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem('usmba_commission_seance_membres', JSON.stringify(memMap));
          }
        }
      } catch {}

      try {
        const rawDl = localStorage.getItem('usmba_commission_pv_downloaded');
        if (rawDl) {
          const dlMap = JSON.parse(rawDl);
          let changed = false;
          removedPvIds.forEach((pvId) => {
            if (dlMap[pvId]) {
              delete dlMap[pvId];
              changed = true;
            }
          });
          affectedDates.forEach((dt) => {
            const hasSlots = remainingCreneaux.some((c) => c.date === dt && Boolean(c.candidatId));
            const hasPvs = remainingPvs.some((p) => p.date === dt);
            if (!hasSlots && !hasPvs && dlMap[dt]) {
              delete dlMap[dt];
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem('usmba_commission_pv_downloaded', JSON.stringify(dlMap));
          }
        }
      } catch {}
    }

    // 6. Remove notifications for targetIds (do NOT touch gcd_journal)
    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      if (rawNotifs) {
        const notifs = JSON.parse(rawNotifs);
        if (Array.isArray(notifs)) {
          const nextNotifs = notifs.filter((n: any) => !(n?.destinataireId && targetIds.has(n.destinataireId)));
          if (nextNotifs.length !== notifs.length) {
            localStorage.setItem('usmba_notifications', JSON.stringify(nextNotifs));
          }
        }
      }
    } catch {}

    localStorage.setItem(CLEANUP_ALAOUI_TARIQ_KEY, 'true');
  } catch {
    // safe fallback
  }
}

migrateTestAccountsIfNeeded();
cleanupAlaouiTariqIfNeeded();

export function getDirectorStructure(directeurId?: string): string {
  if (!directeurId) return '';
  const ens = INITIAL_ENSEIGNANTS.find((e) => e.id === directeurId);
  if (ens?.structure) return ens.structure;
  const comptes = getComptes();
  const cpt = comptes.find((c) => c.enseignantId === directeurId || c.id === directeurId);
  if (cpt?.structure) return cpt.structure;
  if (directeurId === 'ens-1') return 'LISAC - FSDM Fès';
  return '';
}

/**
 * Règle : Anciens PV sans structure : prennent celle de leur directeur à la lecture, sans modifier les données.
 */
export function enrichirPVLecture(pv: import('../types').PV): import('../types').PV {
  if (pv.structure) return pv;
  const fallbackStructure = getDirectorStructure(pv.directeurId);
  return {
    ...pv,
    structure: fallbackStructure,
  };
}

export function formatDateJJMM(d?: string): string {
  if (!d) return '';
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
  }
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    }
  } catch {}
  return d;
}


export function getComptes(): Compte[] {
  try {
    migrateTestAccountsIfNeeded();
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_COMPTES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // fallback to initial
  }
  return INITIAL_COMPTES;
}

export function getConnectedDirecteurId(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const acc = JSON.parse(raw);
        if (acc) {
          if (acc.enseignantId) return acc.enseignantId;
          if (acc.email === 'directeurthese@gmail.com') {
            return 'ens-1';
          }
          if (
            acc.role === 'enseignant' ||
            (Array.isArray(acc.roles) && (acc.roles.includes('enseignant') || acc.roles.includes('directeur')))
          ) {
            return acc.id || 'ens-1';
          }
        }
      }
      const role = localStorage.getItem('usmba_doctorat_role');
      if (role === 'enseignant') {
        return 'ens-1';
      }
    }
  } catch {}
  return null;
}

export function saveComptes(comptes: Compte[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(comptes));
    }
  } catch {
    // ignore
  }
}

export const SEANCES_STATUTS_STORAGE_KEY = 'usmba_seances_statuts';

export function getSeancesStatutsMap(): Record<string, SeanceStatutRecord> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(SEANCES_STATUTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSeanceStatut(
  seanceKey: string,
  record: Partial<SeanceStatutRecord>
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getSeancesStatutsMap();
    current[seanceKey] = {
      ...(current[seanceKey] || {}),
      ...record,
    };
    localStorage.setItem(SEANCES_STATUTS_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('usmba_seances_updated'));
  } catch {}
}

export function calculerStatutSeance(
  date: string,
  enseignantId: string,
  pvsForDateAndDir: PV[],
  statutRecord?: SeanceStatutRecord | null,
  demoDateOverride?: string
): {
  statut: StatutSeance;
  diffJours: number;
  motif?: string;
  relanceLe?: string;
} {
  // 1. Déclarations humaines prioritaires
  if (statutRecord?.statutManuel === 'reportee') {
    return { statut: 'reportee', diffJours: 0, motif: statutRecord.motif, relanceLe: statutRecord.relanceLe };
  }
  if (statutRecord?.statutManuel === 'non_tenue') {
    return { statut: 'non_tenue', diffJours: 0, motif: statutRecord.motif, relanceLe: statutRecord.relanceLe };
  }

  // 2. PV reçu : tous les PV de la séance à 'envoye' ou plus ('envoye' | 'publie' | 'original_recu' | 'approuve')
  const validPvs = pvsForDateAndDir.filter((p) => !p.remplaceePar);
  if (
    validPvs.length > 0 &&
    validPvs.every((p) => p.statut === 'envoye' || p.statut === 'publie' || p.statut === 'original_recu' || p.statut === 'approuve')
  ) {
    return { statut: 'pv_recu', diffJours: 0, relanceLe: statutRecord?.relanceLe };
  }

  // 3. Calcul par rapport à la date de démo (usmba_demo_date)
  const demoDateStr = demoDateOverride || aujourdhui();
  const dateDemo = new Date(demoDateStr + 'T00:00:00Z');
  const dateSeance = new Date(date + 'T00:00:00Z');

  if (dateSeance.getTime() > dateDemo.getTime()) {
    return { statut: 'a_venir', diffJours: 0, relanceLe: statutRecord?.relanceLe };
  }

  const diffMs = dateDemo.getTime() - dateSeance.getTime();
  const diffJours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffJours <= DELAI_PV_JOURS) {
    return { statut: 'pv_attendu', diffJours, relanceLe: statutRecord?.relanceLe };
  } else {
    return { statut: 'pv_en_retard', diffJours, relanceLe: statutRecord?.relanceLe };
  }
}


