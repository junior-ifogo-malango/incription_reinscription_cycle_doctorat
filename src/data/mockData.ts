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
} from '../types';

export const INITIAL_ENSEIGNANTS: Enseignant[] = [
  {
    id: 'ens-1',
    nom: 'Pr. Karim El Amrani',
    email: 'prof@demo.ma',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    structure: 'LISAC - FSDM Fès',
    role: 'enseignant',
  },
  {
    id: 'ens-2',
    nom: 'Pr. Amina Bennani',
    email: 'a.bennani@usmba.ac.ma',
    etablissement: 'Faculté des Sciences et Techniques (FST Fès)',
    structure: 'Laboratoire Génie Industriel & IA Appliquée',
  },
  {
    id: 'ens-3',
    nom: 'Pr. Mehdi Berrada',
    email: 'm.berrada@usmba.ac.ma',
    etablissement: 'Faculté des Sciences Juridiques, Économiques et Sociales (FSJES)',
    structure: 'Laboratoire de Recherche en Économie et Management Durable',
  },
  {
    id: 'ens-4',
    nom: 'Pr. Fatima Chraibi',
    email: 'f.chraibi@usmba.ac.ma',
    etablissement: 'Faculté de Médecine, de Pharmacie et de Médecine Dentaire',
    structure: 'Laboratoire de Biotechnologie et Pharmacologie Médicale',
  },
  {
    id: 'ens-5',
    nom: 'Pr. Hassan Tahiri',
    email: 'h.tahiri@usmba.ac.ma',
    etablissement: 'Faculté des Lettres et des Sciences Humaines Saïs',
    structure: 'Laboratoire Patrimoine Fassi et Humanités Numériques',
  },
  {
    id: 'ens-6',
    nom: 'Pr. Zineb Idrissi',
    email: 'z.idrissi@usmba.ac.ma',
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
    statut: 'declaree',
  },
  {
    type: 'DIPLOME',
    statut: 'declaree',
  },
  {
    type: 'RELEVES',
    statut: 'declaree',
  },
  {
    type: 'CV',
    statut: 'declaree',
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
  id: 'cand-001',
  nom: 'Yassine El Fassi',
  cne: 'N138249871',
  cin: 'CD789123',
  email: 'yassine@demo.ma',
  motDePasse: 'demo1234',
  role: 'candidat',
  tel: '0661234567',
  panier: ['suj-07', 'suj-13'],
  candidatures: ['suj-01', 'suj-04'],
  candidaturesStatuts: {
    'suj-01': 'deposee',
    'suj-04': 'deposee',
  },
  compteCree: true,
  dossier: {
    casParticulier: false,
    guichet: false,
  },
  cursus: {
    diplome: 'Master Sciences et Techniques',
    etablissement: 'Faculté des Sciences et Techniques (FST Fès)',
    anneeObtention: 2026,
    mention: 'Bien',
  },
  pieces: INITIAL_PIECES_YASSINE,
};

export const INITIAL_PIECES: Piece[] = [
  {
    id: 'piece-1',
    candidatId: 'cand-001',
    type: 'cin',
    statut: 'declaree',
    dateMaj: '2026-10-20',
  },
  {
    id: 'piece-2',
    candidatId: 'cand-001',
    type: 'diplome',
    statut: 'prouvee',
    fichier: 'master_sciences_techniques_usmba.pdf',
    source: 'apogee',
    dateMaj: '2026-10-21',
  },
  {
    id: 'piece-3',
    candidatId: 'cand-001',
    type: 'releves',
    statut: 'declaree',
    fichier: 'releves_notes_m1_m2_signes.pdf',
    source: 'televersement',
    dateMaj: '2026-10-22',
  },
  {
    id: 'piece-4',
    candidatId: 'cand-001',
    type: 'cv',
    statut: 'declaree',
    fichier: 'cv_academique_yassine_elfassi.pdf',
    source: 'televersement',
    dateMaj: '2026-10-22',
  },
];

export const INITIAL_DOSSIER: Dossier = {
  candidatId: 'cand-001',
  casParticulier: false,
  motif: '',
  consentementApogee: true,
  statutGlobal: 'en_cours',
};

export const CANDIDAT_SARA: Candidat = {
  id: 'cand-sara',
  nom: 'Sara Benjelloun',
  cne: 'F134567891',
  cin: 'CD812345',
  email: 'sara.benjelloun@demo.ma',
  tel: '0612345678',
  panier: ['suj-01'],
  candidatures: ['suj-01'],
  candidaturesStatuts: { 'suj-01': 'retenue' },
  compteCree: true,
};

export const CANDIDAT_OMAR: Candidat = {
  id: 'cand-omar',
  nom: 'Omar Idrissi',
  cne: 'N142987654',
  cin: 'CD954321',
  email: 'omar.idrissi@demo.ma',
  tel: '0698765432',
  panier: ['suj-01'],
  candidatures: ['suj-01'],
  candidaturesStatuts: { 'suj-01': 'retenue' },
  compteCree: true,
};

export const DEMO_AGENT_KARIMA = {
  id: 'agent-001',
  nom: 'Karima Tazi',
  email: 'karima.tazi@usmba.ac.ma',
  role: 'agent' as const,
};

export const CANDIDAT_SALMA: Candidat = {
  id: 'cand-salma',
  nom: 'Salma Alami',
  cne: 'N149021873',
  cin: 'CD654321',
  email: 'salma.alami@demo.ma',
  tel: '0612',
  panier: ['suj-04'],
  candidatures: ['suj-04'],
  candidaturesStatuts: { 'suj-04': 'retenue' },
  compteCree: true,
  dossier: {
    casParticulier: false,
    guichet: true,
    guichetStatut: 'a_contacter',
    journalGuichet: [
      {
        date: '2026-10-24T09:00:00Z',
        agent: 'Candidat (Salma Alami)',
        action: 'Demande du candidat',
      },
    ],
  },
  pieces: [
    { type: 'CIN', statut: 'declaree' },
    { type: 'DIPLOME', statut: 'absente' },
    { type: 'RELEVES', statut: 'absente' },
    { type: 'CV', statut: 'absente' },
  ],
};

export const CANDIDAT_KHADIJA: Candidat = {
  id: 'cand-khadija',
  nom: 'Khadija Tazi',
  cne: 'M142078911',
  cin: 'CD321987',
  email: 'khadija.tazi@demo.ma',
  tel: '0665432198',
  panier: ['suj-03'],
  candidatures: ['suj-03'],
  candidaturesStatuts: { 'suj-03': 'retenue' },
  compteCree: true,
};

export const MOCK_CANDIDATS: Candidat[] = [
  DEMO_CANDIDAT_YASSINE,
  CANDIDAT_SARA,
  CANDIDAT_OMAR,
  CANDIDAT_SALMA,
  CANDIDAT_KHADIJA,
];

// Créneaux d'entretien simulés (avec un créneau réservé > 48h pour tester l'alerte CED du module 5)
export const INITIAL_CRENEAUX: Creneau[] = [
  {
    id: 'cr-201',
    enseignantId: 'ens-1',
    date: '2026-11-10',
    heure: '10:00',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    candidatId: 'cand-sara',
    statut: 'confirme',
    dateReservation: '2026-10-25T09:00:00Z',
    dateConfirmation: '2026-10-25T10:30:00Z',
  },
  {
    id: 'cr-202',
    enseignantId: 'ens-1',
    date: '2026-11-10',
    heure: '11:30',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    candidatId: 'cand-omar',
    statut: 'confirme',
    dateReservation: '2026-10-25T09:15:00Z',
    dateConfirmation: '2026-10-25T11:00:00Z',
  },
  {
    id: 'cr-101',
    enseignantId: 'ens-1',
    date: '2026-11-04',
    heure: '09:30',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    candidatId: 'cand-salma',
    statut: 'reserve',
    dateReservation: '2026-10-22T08:00:00Z', // Plus de 48h en arrière : test d'alerte CED
  },
  {
    id: 'cr-102',
    enseignantId: 'ens-1',
    date: '2026-11-04',
    heure: '11:00',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    statut: 'libre',
  },
  {
    id: 'cr-103',
    enseignantId: 'ens-1',
    date: '2026-11-05',
    heure: '14:30',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    statut: 'libre',
  },
  {
    id: 'cr-104',
    enseignantId: 'ens-1',
    date: '2026-11-05',
    heure: '16:00',
    lieu: 'Salle des Thèses 1 - FSDM Fès',
    statut: 'libre',
  },
  {
    id: 'cr-105',
    enseignantId: 'ens-3',
    date: '2026-11-06',
    heure: '10:00',
    lieu: 'Visioconférence Google Meet (Lien CED)',
    candidatId: 'cand-khadija',
    statut: 'confirme',
    dateReservation: '2026-10-24T14:00:00Z',
    dateConfirmation: '2026-10-24T16:00:00Z',
  },
  {
    id: 'cr-106',
    enseignantId: 'ens-4',
    date: '2026-11-07',
    heure: '09:00',
    lieu: 'Département Biotechnologie - FMP Fès',
    statut: 'libre',
  },
];

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
  email: 'nadia.alaoui@usmba.ac.ma',
  tel: '0612345678',
  annee: 2,
  encadrantId: 'ens-1',
  sujetTitre: 'Intelligence Artificielle Distribuée pour l’Optimisation Énergétique des Bâtiments Intelligents',
  structure: 'Laboratoire LISAC - Faculté des Sciences Dhar El Mehraz (FSDM)',
};

export const INITIAL_RAPPORTS: Rapport[] = [
  // 1. Rapport de Nadia Alaoui (Doctorante 2e année) : statut 'soumis' (> 48h)
  {
    id: 'rap-nadia-2026',
    doctorantId: 'doc-nadia',
    encadrantId: 'ens-1',
    annee: 2,
    titre: 'Intelligence Artificielle Distribuée pour l’Optimisation Énergétique des Bâtiments Intelligents',
    avancement: 'Finalisation de la revue de la littérature et validation expérimentale du modèle prédictif multi-agents sur banc d\'essai. Les premiers résultats indiquent une réduction de 18% de la consommation de pointe.',
    publications: [
      {
        titre: 'Multi-Agent Deep Reinforcement Learning for Microgrid Management',
        doi: '10.1109/TSE.2026.0142',
      },
    ],
    communications: [
      {
        titre: 'Conférence Nationale sur les Réseaux Intelligents (FSDM Fès)',
        lieu: 'Fès',
      },
    ],
    formationsHeures: 35,
    perspectives: 'Déploiement à grande échelle sur le campus universitaire et soumission d\'un article de revue internationale Q1.',
    aucuneActivite: false,
    statut: 'soumis',
    soumisLe: '2026-10-25T08:30:00Z', // Plus de 48h
    commentaires: [],
    chronologie: [
      {
        date: '25/10/2026',
        acteur: 'Doctorante (Nadia Alaoui)',
        action: 'Dépôt et soumission du rapport d’activité annuel (2ᵉ année)',
      },
    ],
  },
  // 2. Rapport de Tariq Mansouri (Doctorant 3e année) : statut 'avis_comite' (> 48h) avec 1 favorable et 2 en attente
  {
    id: 'rap-tariq-2026',
    doctorantId: 'doc-tariq',
    encadrantId: 'ens-1',
    annee: 3,
    titre: 'Matériaux Nanostructurés pour la Captation et le Stockage du Carbone Industriel',
    avancement: 'Synthèse des zéolithes mésoporeuses et tests d\'adsorption sous différentes conditions de pression et de température.',
    publications: [
      {
        titre: 'Advanced Nanomaterials for CO2 Sequestration in Continental Environments',
        doi: '10.1016/j.carbon.2025.109',
      },
    ],
    communications: [
      {
        titre: 'Congrès International des Matériaux Avancés et Énergies Vertes',
        lieu: 'Rabat',
      },
    ],
    formationsHeures: 42,
    perspectives: 'Rédaction du manuscrit de thèse et soutenance prévue au printemps 2027.',
    aucuneActivite: false,
    statut: 'avis_comite',
    soumisLe: '2026-10-24T10:00:00Z', // Plus de 48h
    comite: [
      {
        membre: 'Pr. Mustapha Bennani (Rapporteur 1)',
        code: 'COMITE77K92M',
        avis: 'FAVORABLE',
        commentaire: 'Travail d\'excellente facture, objectifs scientifiques largement atteints.',
        votéLe: '2026-10-26T14:00:00Z',
      },
      {
        membre: 'Pr. Leila Chraibi (Expert 2)',
        code: 'COMITE88P44X',
      },
      {
        membre: 'Pr. Rachid Tahiri (Laboratoire 3)',
        code: 'COMITE99W66Q',
      },
    ],
    commentaires: [
      {
        auteur: 'Pr. Karim El Amrani',
        date: '25/10/2026',
        texte: 'Très bonne progression. Je valide le rapport pour avis du comité de thèse.',
      },
    ],
    chronologie: [
      {
        date: '24/10/2026',
        acteur: 'Doctorant (Tariq Mansouri)',
        action: 'Dépôt et soumission du rapport d’activité annuel (3ᵉ année)',
      },
      {
        date: '25/10/2026',
        acteur: 'Pr. Karim El Amrani (Encadrant)',
        action: 'Validation du rapport (vaut signature) et saisine du comité',
      },
      {
        date: '26/10/2026',
        acteur: 'Pr. Mustapha Bennani (Membre 1)',
        action: 'Avis FAVORABLE émis avec mention',
      },
    ],
  },
];

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
    email: 'admin@demo.ma',
    motDePasse: 'demo1234',
    role: 'admin',
    structure: 'Présidence USMBA - Pôle Scolarité & Doctorat',
    etablissement: 'Université Sidi Mohamed Ben Abdellah',
    statut: 'actif',
    dateCreation: '2026-10-01',
  },
  {
    id: 'cpt-karim-structure',
    nom: 'Pr. Karim El Amrani',
    email: 'karim.structure@demo.ma',
    motDePasse: 'demo1234',
    role: 'enseignant',
    roles: ['directeur', 'structure'],
    structure: 'Laboratoire LISAC & Direction CED',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    statut: 'actif',
    dateCreation: '2026-11-07',
    enseignantId: 'ens-1',
  },
  {
    id: 'cpt-ced-demo',
    nom: 'Direction CED (Structure)',
    email: 'ced@demo.ma',
    motDePasse: 'demo1234',
    role: 'directeur_ced',
    roles: ['structure'],
    structure: 'LISAC - FSDM Fès',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    statut: 'actif',
    dateCreation: '2026-11-01',
  },
  {
    id: 'cpt-att-1',
    nom: 'Pr. Nadia Berrada',
    email: 'n.berrada@demo.ma',
    motDePasse: 'demo1234',
    role: 'enseignant',
    roles: ['directeur'],
    structure: 'Laboratoire Génie Industriel & IA Appliquée',
    etablissement: 'Faculté des Sciences et Techniques (FST Fès)',
    statut: 'en_attente',
    dateCreation: '2026-11-01',
  },
  {
    id: 'cpt-att-2',
    nom: 'M. Rachid Lahlou',
    email: 'r.lahlou@demo.ma',
    motDePasse: 'demo1234',
    role: 'directeur_ced',
    roles: ['structure'],
    structure: 'Centre d’Études Doctorales USMBA',
    etablissement: 'Présidence USMBA',
    statut: 'en_attente',
    dateCreation: '2026-11-02',
  },
];

export const STORAGE_KEY_COMPTES = 'gcd_comptes';

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
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_COMPTES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let updated = false;
          if (!parsed.some((c: any) => c.email === 'karim.structure@demo.ma')) {
            const demoKarim = INITIAL_COMPTES.find((c) => c.email === 'karim.structure@demo.ma');
            if (demoKarim) {
              parsed.push(demoKarim);
              updated = true;
            }
          }
          const cedCompte = parsed.find((c: any) => c.email === 'ced@demo.ma');
          if (cedCompte) {
            if (cedCompte.structure !== 'LISAC - FSDM Fès') {
              cedCompte.structure = 'LISAC - FSDM Fès';
              updated = true;
            }
          } else {
            const demoCed = INITIAL_COMPTES.find((c) => c.email === 'ced@demo.ma');
            if (demoCed) {
              parsed.push(demoCed);
              updated = true;
            }
          }
          if (updated) {
            localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(parsed));
          }
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
          if (
            acc.email === 'karim.structure@demo.ma' ||
            acc.email === 'prof@demo.ma' ||
            acc.email === 'k.elamrani@usmba.ac.ma'
          ) {
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

