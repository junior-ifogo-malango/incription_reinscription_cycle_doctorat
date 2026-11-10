/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  GraduationCap,
  LogIn,
  LogOut,
  RotateCcw,
  User,
  ChevronDown,
  ShoppingBag,
  FolderKanban,
  Search,
  CalendarCheck2,
  ShieldAlert,
  Award,
  X,
  UserCog,
  Users,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { UserRole, Role, Compte, Candidat, Enseignant, Sujet, Piece, Creneau, Notification, type Dossier as DossierData, Rapport, Vote, CandidatureStatut, normaliserRole, getCompteRoles, dossierComplet } from './types';
import { storageService } from './services/storage';
import { INITIAL_RAPPORTS, DEMO_DOCTORANT_NADIA, aujourdhui, getComptes, MOCK_CANDIDATS } from './data/mockData';
import { fr } from './i18n/fr';
import { LoginModal } from './components/LoginModal';
import { MobileNav, TabType } from './components/MobileNav';
import { Notifications } from './components/Notifications';
import { StatusBadge } from './components/StatusBadge';
import { SujetsModule } from './components/SujetsModule';
import { Dossier } from './components/Dossier';
import { DossierDirecteur } from './components/DossierDirecteur';
import { Entretiens } from './components/Entretiens';
import { MesCreneaux } from './components/MesCreneaux';
import { Exceptions } from './components/Exceptions';
import { Commission } from './components/Commission';
import { RapportComponent } from './components/Rapport';
import { VoteComite } from './components/VoteComite';
import { CedReinscriptions } from './components/CedReinscriptions';
import { CedSeances } from './components/CedSeances';
import { VerifPV } from './components/VerifPV';
import { Guichet } from './components/Guichet';
import { Admin } from './components/Admin';

export type AppTabType =
  | TabType
  | 'commission'
  | 'rapport'
  | 'suivi'
  | 'reinscriptions'
  | 'seances'
  | 'vote_comite'
  | 'guichet'
  | 'admin_comptes'
  | 'admin_journal';

function genererCodeComite(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 12; i++) array[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

function useEstMobile(): boolean {
  const [estMobile, setEstMobile] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setEstMobile(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    setEstMobile(mediaQuery.matches);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  return estMobile;
}

function formatDateJJMM(d?: string): string {
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

function isPdfData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:application/pdf') || data.toLowerCase().endsWith('.pdf');
}

function openPdfInNewTab(dataUrl: string): void {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch {
    // Échec sans plantage
  }
}

function getDoctorantNom(docId: string): string {
  if (docId === 'doc-nadia') return DEMO_DOCTORANT_NADIA.nom;
  if (docId === 'doc-tariq') return 'Tariq Mansouri';
  const cand = MOCK_CANDIDATS.find((c) => c.id === docId);
  if (cand) return cand.nom;
  return docId;
}

export default function App() {
  const estMobile = useEstMobile();
  const [role, setRole] = useState<UserRole>('candidat');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeCompte, setActiveCompte] = useState<Compte | null>(() => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const userRoles: Role[] = useMemo(() => {
    if (!isLoggedIn) return ['candidat'];
    if (activeCompte) {
      return getCompteRoles(activeCompte);
    }
    return role ? [role] : ['candidat'];
  }, [isLoggedIn, activeCompte, role]);

  const normalizedRoles: UserRole[] = useMemo(() => {
    const list = userRoles.map((r) => normaliserRole(r));
    return Array.from(new Set(list));
  }, [userRoles]);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<AppTabType>(() => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.role === 'enseignant' || parsed.roles?.includes('directeur') || parsed.roles?.includes('enseignant')) {
          return 'candidatures_recues';
        }
      }
    } catch {}
    return 'sujets';
  });
  const [candidat, setCandidat] = useState<Candidat>(storageService.getCandidat());
  const [sujets, setSujets] = useState<Sujet[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [dossier, setDossier] = useState<DossierData>(storageService.getDossier());
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [rapports, setRapports] = useState<Rapport[]>(() => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_rapports') || localStorage.getItem('usmba_rapports');
      if (raw) return JSON.parse(raw);
      localStorage.setItem('usmba_rapports', JSON.stringify(INITIAL_RAPPORTS));
      localStorage.setItem('usmba_doctorat_rapports', JSON.stringify(INITIAL_RAPPORTS));
      return INITIAL_RAPPORTS;
    } catch {
      return INITIAL_RAPPORTS;
    }
  });
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  const [teacherFeedbackMsg, setTeacherFeedbackMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [simulatedStatuts, setSimulatedStatuts] = useState<Record<string, 'deposee' | 'retenue'>>({});
  const [selectedCandidatForDossier, setSelectedCandidatForDossier] = useState<{ id: string; nom: string } | null>(null);
  const [viewingRapport, setViewingRapport] = useState<Rapport | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoDateInput, setDemoDateInput] = useState<string>(() => {
    try {
      return localStorage.getItem('usmba_demo_date') || '';
    } catch {
      return '';
    }
  });

  const handleDemoDateChange = (newDate: string) => {
    setDemoDateInput(newDate);
    try {
      if (newDate) {
        localStorage.setItem('usmba_demo_date', newDate);
      } else {
        localStorage.removeItem('usmba_demo_date');
      }
      window.dispatchEvent(new CustomEvent('usmba_demo_date_updated', { detail: newDate }));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDemoDate = () => {
    setDemoDateInput('');
    try {
      localStorage.removeItem('usmba_demo_date');
      window.dispatchEvent(new CustomEvent('usmba_demo_date_updated', { detail: '' }));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch (e) {
      console.error(e);
    }
  };

  const [verifCode, setVerifCode] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#verif/')) {
      return decodeURIComponent(window.location.hash.replace(/^#verif\/?/, '').trim());
    }
    return null;
  });

  // Écoute de la route de vérification #verif/CODE
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#verif/')) {
        const code = decodeURIComponent(hash.replace(/^#verif\/?/, '').trim());
        setVerifCode(code || null);
      } else {
        setVerifCode(null);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Initialisation au montage : démarre en visiteur sans compte
  useEffect(() => {
    storageService.initializeIfNeeded();
    try {
      if (!localStorage.getItem('usmba_rapports')) {
        localStorage.setItem('usmba_rapports', JSON.stringify(INITIAL_RAPPORTS));
      }
    } catch {
      // safe fallback
    }
    refreshState();
    setTab('sujets');

    const handleSync = () => {
      refreshState();
    };
    window.addEventListener('usmba_pieces_updated', handleSync);
    window.addEventListener('usmba_rapports_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pieces_updated', handleSync);
      window.removeEventListener('usmba_rapports_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const refreshState = () => {
    setCandidat(storageService.getCandidat());
    setSujets(storageService.getSujets());
    setEnseignants(storageService.getEnseignants());
    setPieces(storageService.getPieces());
    setDossier(storageService.getDossier());
    setCreneaux(storageService.getCreneaux());
    try {
      const raw = localStorage.getItem('usmba_doctorat_rapports') || localStorage.getItem('usmba_rapports');
      if (raw) setRapports(JSON.parse(raw));
    } catch {
      // safe fallback
    }
  };

  const handleLoginSuccess = (
    userRole: UserRole,
    userEmail?: string,
    candidateData?: Candidat,
    connectedCompte?: Compte
  ) => {
    setIsLoggedIn(true);
    setRole(userRole);
    setRestrictionMsg(undefined);

    let compteToStore = connectedCompte || null;
    if (!compteToStore && userEmail) {
      const allComptes = getComptes();
      compteToStore =
        allComptes.find((c) => c.email && c.email.toLowerCase().trim() === userEmail.toLowerCase().trim()) || null;
    }
    if (!compteToStore && userRole === 'enseignant') {
      compteToStore = {
        id: 'ens-1',
        nom: 'Pr. Karim El Amrani',
        email: userEmail || 'prof@demo.ma',
        role: 'enseignant',
        roles: ['directeur'],
        structure: 'LISAC - FSDM Fès',
        statut: 'actif',
        enseignantId: 'ens-1',
      };
    } else if (!compteToStore && userRole === 'directeur_ced') {
      compteToStore = {
        id: 'dir-ced',
        nom: 'Direction CED',
        email: userEmail || 'ced@demo.ma',
        role: 'directeur_ced',
        roles: ['structure'],
        structure: 'CED USMBA',
        statut: 'actif',
      };
    }
    setActiveCompte(compteToStore);
    try {
      if (compteToStore) {
        localStorage.setItem('usmba_active_account', JSON.stringify(compteToStore));
      } else {
        localStorage.removeItem('usmba_active_account');
      }
      window.dispatchEvent(new CustomEvent('usmba_account_updated'));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch {}

    if (userRole === 'candidat') {
      if (candidateData) {
        setCandidat(candidateData);
        storageService.setCandidat(candidateData);
      } else {
        const demo = storageService.loginAsDemo();
        setCandidat(demo);
      }
      setTab('sujets');
    } else if (userRole === 'admin') {
      setTab('admin_comptes');
    } else if (userRole === 'enseignant') {
      setTab('candidatures_recues');
    } else if (userRole === 'doctorant') {
      setTab('rapport');
    } else if (userRole === 'agent') {
      setTab('guichet');
    } else {
      setTab('seances');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole('candidat');
    setActiveCompte(null);
    try {
      localStorage.removeItem('usmba_active_account');
      window.dispatchEvent(new CustomEvent('usmba_account_updated'));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch {}
    const visitor: Candidat = {
      id: 'visiteur-001',
      nom: '',
      cne: '',
      cin: '',
      email: '',
      tel: '',
      panier: candidat.panier,
      candidatures: [],
      compteCree: false,
    };
    setCandidat(visitor);
    storageService.setCandidat(visitor);
    setTab('sujets');
  };

  const handleTabChange = (targetTab: AppTabType) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      if (raw) {
        const parsed: Candidat = JSON.parse(raw);
        setCandidat(parsed);
      }
    } catch {
      // safe fallback
    }

    // Protection stricte Admin : navigation exclusive entre ses 2 onglets, aucun accès aux autres écrans
    if (normalizedRoles.includes('admin') && !normalizedRoles.some((r) => r !== 'admin')) {
      if (targetTab === 'admin_comptes' || targetTab === 'admin_journal') {
        setTab(targetTab);
      }
      return;
    }

    // Protection des onglets admin pour les non-admins
    if ((targetTab === 'admin_comptes' || targetTab === 'admin_journal') && !normalizedRoles.includes('admin')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    // Pages ouvertes aux visiteurs
    if (targetTab === 'sujets' || targetTab === 'panier' || targetTab === 'vote_comite') {
      setTab(targetTab);
      return;
    }

    // Protection des pages nécessitant un rôle
    if (!isLoggedIn) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'dossier' && !normalizedRoles.includes('candidat')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'candidatures_recues' && !normalizedRoles.includes('enseignant')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'entretiens' && !normalizedRoles.includes('candidat') && !normalizedRoles.includes('enseignant')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'commission' && !normalizedRoles.includes('enseignant')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (
      (targetTab === 'ced' || targetTab === 'seances') &&
      !normalizedRoles.includes('directeur_ced')
    ) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (
      targetTab === 'reinscriptions' &&
      !normalizedRoles.includes('directeur_ced') &&
      !normalizedRoles.includes('enseignant')
    ) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if ((targetTab === 'rapport' || targetTab === 'suivi') && !normalizedRoles.includes('doctorant')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'guichet' && !normalizedRoles.includes('agent')) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    setSelectedCandidatForDossier(null);
    setTab(targetTab);
  };

  const handleResetData = () => {
    const confirmation = window.confirm(fr.nav.resetConfirmPrompt);
    if (!confirmation) return;

    try {
      localStorage.clear();
    } catch {
      // safe fallback
    }

    storageService.resetToDefaults();
    try {
      localStorage.setItem('usmba_rapports', JSON.stringify(INITIAL_RAPPORTS));
    } catch {
      // safe fallback
    }

    setDemoDateInput('');
    refreshState();
    window.dispatchEvent(new CustomEvent('usmba_demo_date_updated', { detail: '' }));
    window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
    window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
    window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
    window.dispatchEvent(new CustomEvent('usmba_dossier_updated'));
    window.dispatchEvent(new CustomEvent('storage'));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Enseignant actif pour la démo
  const activeEnseignant = enseignants[0] || {
    id: 'ens-1',
    nom: 'Pr. Karim El Amrani',
    email: 'k.elamrani@usmba.ac.ma',
    etablissement: 'Faculté des Sciences Dhar El Mehraz (FSDM)',
    structure: 'Laboratoire LISAC',
  };

  // Sujets de l'enseignant actif
  const sujetsEnseignant = sujets.filter((s) => s.enseignantId === activeEnseignant.id);

  // Créneaux de l'enseignant actif
  const creneauxEnseignant = creneaux.filter(
    (c) => c.enseignantId === activeEnseignant.id
  );

  // Alertes CED (> 48h en attente de confirmation - Tableau d'exceptions)
  const now = Date.now();
  const alertesCreneaux = creneaux.filter((c) => {
    if (c.statut === 'reserve' && c.dateReservation) {
      const reservationTime = new Date(c.dateReservation).getTime();
      const diffHours = (now - reservationTime) / (1000 * 60 * 60);
      return diffHours > 48;
    }
    return false;
  });

  // Candidatures reçues pour l'enseignant actif
  const teacherSubjectIds = sujetsEnseignant.map((s) => s.id);
  const candidaturesEnseignant = useMemo(() => {
    const list: {
      key: string;
      candidatId: string;
      sujetId: string;
      candidatNom: string;
      cne: string;
      sujetTitre: string;
      date: string;
      statut: 'deposee' | 'retenue' | 'a_corriger';
      piecesDeclarees: number;
      piecesProuvees: number;
      motifCasParticulier?: string;
      guichet?: boolean;
      isCurrentCandidat: boolean;
    }[] = [];

    // Candidatures de l'étudiant actif
    if (candidat.compteCree && candidat.candidatures) {
      const activePiecesDeclarees = (candidat.pieces || []).filter(
        (p) => p.statut === 'declaree' || p.statut === 'prouvee'
      ).length;
      const activePiecesProuvees = (candidat.pieces || []).filter(
        (p) => p.statut === 'prouvee'
      ).length;

      let motifLabel: string | undefined = undefined;
      if (candidat.dossier?.casParticulier && candidat.dossier?.motif) {
        if (candidat.dossier.motif === 'AUTRE') {
          motifLabel = candidat.dossier.motifAutre
            ? `Autre : ${candidat.dossier.motifAutre}`
            : fr.dossier.casParticulierMotifs.AUTRE;
        } else {
          motifLabel = fr.dossier.casParticulierMotifs[candidat.dossier.motif];
        }
      }

      candidat.candidatures.forEach((id) => {
        if (teacherSubjectIds.includes(id)) {
          const s = sujets.find((x) => x.id === id);
          if (s) {
            const st = candidat.candidaturesStatuts?.[id] || 'deposee';
            if (st === 'brouillon') {
              return;
            }
            list.push({
              key: `${candidat.id}-${id}`,
              candidatId: candidat.id,
              sujetId: s.id,
              candidatNom: candidat.nom || 'Candidat USMBA',
              cne: candidat.cne || 'CNE',
              sujetTitre: s.titre,
              date: '28/10/2026',
              statut: st,
              piecesDeclarees: activePiecesDeclarees,
              piecesProuvees: activePiecesProuvees,
              motifCasParticulier: motifLabel,
              guichet: Boolean(candidat.dossier?.guichet),
              isCurrentCandidat: true,
            });
          }
        }
      });
    }

    // Candidatures d'autres étudiants simulés pour la démo
    if (activeEnseignant.id === 'ens-1') {
      list.push(
        {
          key: 'salma-suj-07',
          candidatId: 'cand-salma',
          sujetId: 'suj-07',
          candidatNom: 'Salma Alami',
          cne: 'N149021873',
          sujetTitre: 'Cybersécurité des Véhicules Connectés et Protocoles V2X',
          date: '25/10/2026',
          statut: simulatedStatuts['salma-suj-07'] || 'deposee',
          piecesDeclarees: 4,
          piecesProuvees: 3,
          isCurrentCandidat: false,
        },
        {
          key: 'khadija-suj-01',
          candidatId: 'cand-khadija',
          sujetId: 'suj-01',
          candidatNom: 'Khadija Tazi',
          cne: 'M142078911',
          sujetTitre: 'Optimisation des Réseaux Électriques Intelligents (Smart Grids)',
          date: '26/10/2026',
          statut: simulatedStatuts['khadija-suj-01'] || 'deposee',
          piecesDeclarees: 4,
          piecesProuvees: 4,
          motifCasParticulier: fr.dossier.casParticulierMotifs.DIPLOME_ETRANGER,
          isCurrentCandidat: false,
        }
      );
    }

    return list;
  }, [candidat, teacherSubjectIds, sujets, activeEnseignant, simulatedStatuts]);

  const findCandidateApp = (id?: string): Candidat | null => {
    if (!id) return null;
    try {
      const rawAll = localStorage.getItem('usmba_all_candidates');
      if (rawAll) {
        const parsed: Candidat[] = JSON.parse(rawAll);
        const found = parsed.find((c) => c.id === id);
        if (found) return found;
      }
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const parsedCur: Candidat = JSON.parse(rawCur);
        if (parsedCur.id === id) return parsedCur;
      }
    } catch {}
    return MOCK_CANDIDATS.find((c) => c.id === id) || null;
  };

  // Badge de Candidatures = nombre de dossiers complets non validés
  const candidaturesCompletsNonValidesCount = useMemo(() => {
    return candidaturesEnseignant.filter((c) => {
      if (c.statut === 'retenue') return false;
      const candObj = c.isCurrentCandidat ? candidat : findCandidateApp(c.candidatId);
      return candObj ? dossierComplet(candObj).complet : false;
    }).length;
  }, [candidaturesEnseignant, candidat]);

  const handleToggleRetenir = (item: {
    key: string;
    sujetId: string;
    statut: CandidatureStatut;
    isCurrentCandidat: boolean;
    candidatId?: string;
  }) => {
    const newStatut: CandidatureStatut = item.statut === 'deposee' ? 'retenue' : 'deposee';

    if (newStatut === 'retenue') {
      // Au clic sur « Convoquer » : crée une Notification pour le candidat
      try {
        const notifText = `${activeEnseignant.nom} te convoque à l'entretien. À faire : fournis tes preuves et réserve un créneau.`;
        const rawNotifs = localStorage.getItem('usmba_notifications');
        const notifs: Notification[] = rawNotifs ? JSON.parse(rawNotifs) : [];
        const targetCandidatId = item.candidatId || (item.isCurrentCandidat ? candidat.id : 'cand-001');
        const newNotif: Notification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          destinataireId: targetCandidatId,
          texte: notifText,
          date: new Date().toISOString(),
          lue: false,
        };
        notifs.unshift(newNotif);
        localStorage.setItem('usmba_notifications', JSON.stringify(notifs));
        window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
      } catch (err) {
        console.error('Storage error for notification', err);
      }
    }

    if (item.isCurrentCandidat) {
      try {
        const raw = localStorage.getItem('usmba_doctorat_candidat');
        const curCandidat: Candidat = raw ? JSON.parse(raw) : candidat;
        const updatedStatuts = {
          ...(curCandidat.candidaturesStatuts || {}),
          [item.sujetId]: newStatut,
        };
        curCandidat.candidaturesStatuts = updatedStatuts;
        localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(curCandidat));
        setCandidat({ ...curCandidat });
      } catch (err) {
        console.error('Storage error', err);
      }
    } else {
      setSimulatedStatuts((prev) => ({
        ...prev,
        [item.key]: newStatut,
      }));
    }
  };

  const piecesPretesCount = pieces.filter(
    (p) => p.statut === 'prouvee' || p.statut === 'declaree'
  ).length;

  // Calcul candidat retenu & pièces restantes à prouver (Repère Preuves à fournir)
  const isCandidatRetenu = useMemo(() => {
    if (!isLoggedIn || role !== 'candidat') return false;
    const statuts = candidat.candidaturesStatuts || {};
    return Boolean(
      (candidat.candidatures || []).some(
        (id) => (simulatedStatuts[id] || statuts[id]) === 'retenue'
      ) ||
      Object.values(statuts).some((s) => s === 'retenue')
    );
  }, [isLoggedIn, role, candidat, simulatedStatuts]);

  const candidatePieces = useMemo(() => {
    if (candidat.pieces && Array.isArray(candidat.pieces) && candidat.pieces.length === 4) {
      return candidat.pieces;
    }
    return pieces;
  }, [candidat.pieces, pieces]);

  const piecesAProverCount = useMemo(() => {
    return candidatePieces.filter((p) => p.statut !== 'prouvee').length;
  }, [candidatePieces]);

  const isRetenuWithUnproven = isCandidatRetenu && piecesAProverCount > 0;

  // Rapports de réinscription en attente de validation par l'encadrant
  const rapportsAValider = useMemo(() => {
    return rapports.filter(
      (r) => r.statut === 'soumis' && (r.encadrantId === activeEnseignant.id || activeEnseignant.id === 'ens-1')
    );
  }, [rapports, activeEnseignant]);

  const rapportsDirecteur = useMemo(() => {
    return rapports.filter(
      (r) => r.encadrantId === activeEnseignant.id || activeEnseignant.id === 'ens-1'
    );
  }, [rapports, activeEnseignant]);

  const handleTeacherValiderRapport = (rapportId: string) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_rapports') || localStorage.getItem('usmba_rapports');
      const list: Rapport[] = raw ? JSON.parse(raw) : rapports;
      const index = list.findIndex((r) => r.id === rapportId);
      if (index === -1) return;

      const dateStr = new Date().toISOString();
      const commentText = (teacherComments[rapportId] || '').trim();

      const updatedCommentaires = [...list[index].commentaires];
      if (commentText) {
        updatedCommentaires.push({
          auteur: activeEnseignant.nom,
          date: dateStr,
          texte: commentText,
        });
      }

      const votes: Vote[] = [
        { membre: 'Pr. A. Benjelloun (Rapporteur externe)', code: genererCodeComite() },
        { membre: 'Pr. F. Zahraoui (Spécialiste discipline)', code: genererCodeComite() },
        { membre: 'Pr. M. Idrissi (Représentant laboratoire)', code: genererCodeComite() },
      ];

      const updatedChronologie = [
        ...list[index].chronologie,
        {
          date: dateStr,
          acteur: activeEnseignant.nom,
          action: `${fr.reinscription.btnValiderEncadrant} (signature)`,
        },
        {
          date: dateStr,
          acteur: 'Système',
          action: 'Transmission au comité de suivi de thèse (3 membres désignés)',
        },
      ];

      list[index] = {
        ...list[index],
        statut: 'avis_comite',
        commentaires: updatedCommentaires,
        comite: votes,
        chronologie: updatedChronologie,
      };

      try {
        localStorage.setItem('usmba_rapports', JSON.stringify(list));
        localStorage.setItem('usmba_doctorat_rapports', JSON.stringify(list));
      } catch (err) {
        console.error(err);
      }
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      setRapports(list);
      setTeacherFeedbackMsg(fr.reinscription.encadrantValidatedToast);
      setTimeout(() => setTeacherFeedbackMsg(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTeacherCorrigerRapport = (rapportId: string) => {
    const commentText = (teacherComments[rapportId] || '').trim();
    if (commentText.length < 5) return;

    try {
      const raw = localStorage.getItem('usmba_doctorat_rapports') || localStorage.getItem('usmba_rapports');
      const list: Rapport[] = raw ? JSON.parse(raw) : rapports;
      const index = list.findIndex((r) => r.id === rapportId);
      if (index === -1) return;

      const dateStr = new Date().toISOString();
      const updatedCommentaires = [
        ...list[index].commentaires,
        {
          auteur: activeEnseignant.nom,
          date: dateStr,
          texte: commentText,
        },
      ];

      const updatedChronologie = [
        ...list[index].chronologie,
        {
          date: dateStr,
          acteur: activeEnseignant.nom,
          action: `${fr.reinscription.btnCorrigerEncadrant} : "${commentText}"`,
        },
      ];

      list[index] = {
        ...list[index],
        statut: 'a_corriger',
        commentaires: updatedCommentaires,
        chronologie: updatedChronologie,
      };

      try {
        localStorage.setItem('usmba_rapports', JSON.stringify(list));
        localStorage.setItem('usmba_doctorat_rapports', JSON.stringify(list));
      } catch (err) {
        console.error(err);
      }
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      setRapports(list);
      setTeacherFeedbackMsg(fr.reinscription.encadrantCorrectionToast);
      setTimeout(() => setTeacherFeedbackMsg(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  const currentUserName = isLoggedIn
    ? role === 'candidat'
      ? candidat.nom || 'Candidat'
      : role === 'enseignant'
      ? activeEnseignant.nom
      : role === 'doctorant'
      ? DEMO_DOCTORANT_NADIA.nom
      : role === 'agent'
      ? 'Karima Tazi'
      : role === 'admin'
      ? 'Service Scolarité'
      : fr.app.cedName
    : undefined;

  const currentUserEmail = isLoggedIn
    ? activeCompte?.email ||
      (role === 'candidat'
        ? (candidat.email || 'yassine@demo.ma')
        : role === 'enseignant'
        ? (activeEnseignant.email || 'prof@demo.ma')
        : role === 'directeur_ced'
        ? 'ced@demo.ma'
        : role === 'admin'
        ? 'admin@demo.ma'
        : role === 'doctorant'
        ? (DEMO_DOCTORANT_NADIA.email || 'nadia.alaoui@usmba.ac.ma')
        : role === 'agent'
        ? 'karima.tazi@usmba.ac.ma'
        : 'compte@demo.ma')
    : undefined;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-200">
      {/* Conteneur sobre centré max ~1100px */}
      <div className="w-full max-w-[1100px] mx-auto min-h-screen bg-white shadow-sm flex flex-col pb-16 md:pb-6 relative">
        {/* En-tête avec repère Preuves à fournir sur l'onglet Mon dossier */}
        <header className="sticky top-0 z-40 bg-emerald-950 text-white shadow-md border-b border-emerald-900">
          <div className="max-w-[1100px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Gauche : Logo + USMBA Fès */}
            <div
              onClick={() => handleTabChange('sujets')}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300 shadow-inner">
                <GraduationCap size={20} />
              </div>
              <span className="font-bold text-sm tracking-tight text-white block">
                {fr.app.institution}
              </span>
            </div>

            {/* Droite : Menu desktop + Icône panier */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Menu horizontal sur tablette et PC (≥768px) */}
              <nav className="flex items-center gap-1">
                {/* Onglets selon l'union des rôles du compte (sans doublon, sans sélecteur) */}
                <div className="hidden md:flex items-center gap-1">
                {isLoggedIn && (
                  <>
                    {/* Menu ENSEIGNANT (Directeur) : Candidatures, Créneaux, Commission, Sujets, puis Réinscriptions */}
                    {normalizedRoles.includes('enseignant') && (
                      <>
                        {/* 1. Candidatures */}
                        <button
                          onClick={() => handleTabChange('candidatures_recues')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'candidatures_recues'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.candidatures}</span>
                          {candidaturesCompletsNonValidesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                              {candidaturesCompletsNonValidesCount}
                            </span>
                          )}
                        </button>

                        {/* 2. Créneaux */}
                        <button
                          onClick={() => handleTabChange('entretiens')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'entretiens'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.mesCreneaux}</span>
                        </button>

                        {/* 3. Commission */}
                        <button
                          onClick={() => handleTabChange('commission')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'commission'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <Award size={14} />
                          <span>{fr.commission.tabTitle}</span>
                        </button>

                        {/* 4. Sujets */}
                        <button
                          onClick={() => handleTabChange('sujets')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'sujets'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.mesSujets}</span>
                        </button>

                        {/* 5. Réinscriptions (PC) */}
                        <button
                          onClick={() => handleTabChange('reinscriptions')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'reinscriptions'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.reinscriptions}</span>
                          {rapportsAValider.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                              {rapportsAValider.length}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {/* Menu CANDIDAT (uniquement si non enseignant) */}
                    {normalizedRoles.includes('candidat') && !normalizedRoles.includes('enseignant') && (
                      <>
                        <button
                          onClick={() => handleTabChange('sujets')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'sujets'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.sujets}</span>
                        </button>

                        <button
                          onClick={() => handleTabChange('dossier')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'dossier'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.dossier}</span>
                          {isRetenuWithUnproven && (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs"
                              title={`${piecesAProverCount} ${fr.dossier.preuvesAFournirCount}`}
                            >
                              <AlertCircle size={10} className="shrink-0" />
                              <span>{piecesAProverCount}</span>
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleTabChange('entretiens')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'entretiens'
                              ? 'bg-emerald-800 text-amber-300'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <span>{fr.nav.entretiens}</span>
                        </button>
                      </>
                    )}

                    {/* Séances : directeur_ced */}
                    {normalizedRoles.includes('directeur_ced') && (
                      <button
                        onClick={() => handleTabChange('seances')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          tab === 'seances'
                            ? 'bg-emerald-800 text-amber-300'
                            : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                        }`}
                      >
                        <span>{fr.nav.seances}</span>
                      </button>
                    )}

                    {/* Réinscriptions : directeur_ced */}
                    {normalizedRoles.includes('directeur_ced') && (
                      <button
                        onClick={() => handleTabChange('reinscriptions')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          tab === 'reinscriptions'
                            ? 'bg-emerald-800 text-amber-300'
                            : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                        }`}
                      >
                        <span>{fr.nav.reinscriptions}</span>
                      </button>
                    )}

                    {/* Exceptions : directeur_ced */}
                    {normalizedRoles.includes('directeur_ced') && (
                      <button
                        onClick={() => handleTabChange('ced')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          tab === 'ced'
                            ? 'bg-emerald-800 text-amber-300'
                            : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                        }`}
                      >
                        <span>{fr.nav.exceptionsCed}</span>
                        {alertesCreneaux.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                            {alertesCreneaux.length}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Scolarité (Admin) */}
                    {normalizedRoles.includes('admin') && (
                      <>
                        <button
                          onClick={() => handleTabChange('admin_comptes')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'admin_comptes'
                              ? 'bg-purple-800 text-purple-200'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <Users size={14} />
                          <span>{fr.nav.adminComptes}</span>
                        </button>
                        <button
                          onClick={() => handleTabChange('admin_journal')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            tab === 'admin_journal'
                              ? 'bg-purple-800 text-purple-200'
                              : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                          }`}
                        >
                          <FileText size={14} />
                          <span>{fr.nav.adminJournal}</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* Visiteur non connecté */}
                {!isLoggedIn && (
                  <button
                    onClick={() => handleTabChange('sujets')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      tab === 'sujets'
                        ? 'bg-emerald-800 text-amber-300'
                        : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                    }`}
                  >
                    <span>{fr.nav.sujets}</span>
                  </button>
                )}
                </div>

                {/* Se connecter ou Mon compte */}
                {!isLoggedIn ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-emerald-100 hover:text-white hover:bg-emerald-900/60 flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogIn size={14} />
                      <span className="hidden sm:inline">{fr.auth.login}</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          accountMenuOpen
                            ? 'bg-emerald-800 text-amber-300'
                            : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                        }`}
                        title={fr.auth.accountMenu}
                      >
                        <User size={14} className="text-emerald-300 shrink-0" />
                        <span className="hidden sm:inline">{fr.nav.court.compte}</span>
                        <ChevronDown size={13} className="hidden sm:inline text-emerald-400 shrink-0" />
                      </button>

                      {accountMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1.5 w-60 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                        >
                          <div className="px-3 py-2 border-b border-slate-100">
                            <p className="font-bold text-slate-900">Visiteur démo</p>
                            <span className="text-[10px] font-semibold text-slate-500">Non connecté</span>
                          </div>

                          <div
                            className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <label htmlFor="demo-date-visitor" className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                                <Calendar size={12} className="text-slate-500" />
                                <span>{fr.demoDate.label}</span>
                              </label>
                              {Boolean(demoDateInput) && (
                                <button
                                  type="button"
                                  onClick={handleResetDemoDate}
                                  className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                                >
                                  {fr.demoDate.reset}
                                </button>
                              )}
                            </div>
                            <input
                              id="demo-date-visitor"
                              type="date"
                              value={demoDateInput || aujourdhui()}
                              onChange={(e) => handleDemoDateChange(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            />
                          </div>

                          <button
                            onClick={() => {
                              setAccountMenuOpen(false);
                              setIsLoginOpen(true);
                            }}
                            className="w-full text-left px-3 py-2 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 font-semibold cursor-pointer"
                          >
                            <LogIn size={13} />
                            <span>{fr.auth.login}</span>
                          </button>

                          <button
                            onClick={() => {
                              setAccountMenuOpen(false);
                              handleResetData();
                            }}
                            className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <RotateCcw size={13} />
                            <span>{fr.nav.resetData}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                        accountMenuOpen
                          ? 'bg-emerald-800 text-amber-300'
                          : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                      }`}
                      title={currentUserEmail || fr.auth.accountMenu}
                    >
                      <User size={14} className="text-emerald-300 shrink-0" />
                      <span className="hidden sm:inline max-w-[140px] truncate">{currentUserEmail}</span>
                      <ChevronDown size={13} className="hidden sm:inline text-emerald-400 shrink-0" />
                    </button>

                    {accountMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-60 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                      >
                        <div className="px-3 py-2 border-b border-slate-100">
                          <p className="font-bold text-slate-900 break-all">{currentUserEmail}</p>
                          {role === 'enseignant' && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                                {fr.auth.profileStructureLabel}
                              </span>
                              <span className="text-[11px] font-medium text-slate-700 break-words block">
                                {activeEnseignant.structure}
                              </span>
                            </div>
                          )}
                        </div>

                        <div
                          className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between">
                            <label htmlFor="demo-date-logged" className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-500" />
                              <span>{fr.demoDate.label}</span>
                            </label>
                            {Boolean(demoDateInput) && (
                              <button
                                type="button"
                                onClick={handleResetDemoDate}
                                className="text-[10px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                              >
                                {fr.demoDate.reset}
                              </button>
                            )}
                          </div>
                          <input
                            id="demo-date-logged"
                            type="date"
                            value={demoDateInput || aujourdhui()}
                            onChange={(e) => handleDemoDateChange(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleResetData();
                          }}
                          className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>{fr.nav.resetData}</span>
                        </button>

                        <button
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <LogOut size={13} />
                          <span>{fr.auth.logout}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </nav>

              {/* Notifications : visible pour le candidat connecté uniquement, à gauche du panier */}
              {isLoggedIn && role === 'candidat' && (
                <Notifications
                  candidatId={candidat.id}
                  onNavigateToDossier={() => handleTabChange('dossier')}
                />
              )}

              {/* Icône panier avec badge (candidats et visiteurs uniquement) */}
              {role !== 'admin' && (
                <button
                  onClick={() => handleTabChange('panier')}
                  aria-label={fr.nav.panier}
                  title={fr.nav.panier}
                  className={`relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    tab === 'panier'
                      ? 'bg-emerald-800 text-amber-300 ring-1 ring-amber-300/40'
                      : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                  }`}
                >
                  <ShoppingBag size={20} />
                  <span
                    className={`absolute -top-1 -right-1 text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-xs transition-colors ${
                      (candidat.panier?.length || 0) > 0
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-emerald-800 text-emerald-300 font-bold'
                    }`}
                  >
                    {candidat.panier?.length || 0}
                  </span>
                </button>
              )}

              {/* Bouton de déconnexion rapide mobile pour Admin */}
              {isLoggedIn && role === 'admin' && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="md:hidden px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-900/80 hover:bg-purple-900 text-purple-200 border border-purple-500/40 flex items-center gap-1 cursor-pointer"
                  title={fr.auth.logout}
                >
                  <LogOut size={13} />
                  <span>{fr.auth.logout}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Toast confirmation réinitialisation */}
        {showToast && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={15} />
              {fr.module1.resetSuccess}
            </span>
          </div>
        )}

        {/* CONTENU PRINCIPAL SELON ONGLET */}
        <main className="flex-1 p-3.5 md:p-6 space-y-4">
          {/* Bandeau d'alerte pour candidat retenu avec pièces à prouver (Accueil) */}
          {isRetenuWithUnproven && tab === 'sujets' && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 sm:p-4 text-amber-950 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                    {fr.dossier.bannerRetenuPreuves}
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    {piecesAProverCount} {fr.dossier.preuvesAFournirCount}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('dossier')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 active:scale-98 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 self-end sm:self-auto"
              >
                <span>{fr.dossier.btnAllerDossier}</span>
              </button>
            </div>
          )}

          {/* Route #verif/CODE : Vérification d'authenticité du PV (sans compte) */}
          {verifCode !== null ? (
            <VerifPV
              code={verifCode}
              onClose={() => {
                window.location.hash = '';
                setVerifCode(null);
              }}
            />
          ) : role === 'admin' && isLoggedIn ? (
            <Admin
              currentTab={tab === 'admin_journal' ? 'admin_journal' : 'admin_comptes'}
              onSelectTab={(newTab) => setTab(newTab)}
            />
          ) : (
            <>
              {/* Onglet Module A2 : Sujets de Recherche (Catalogue) */}
              {tab === 'sujets' && (
            <SujetsModule
              key="catalog"
              role={role}
              sujets={sujets}
              enseignants={enseignants}
              candidat={candidat}
              onUpdateCandidat={(updated) => {
                setCandidat(updated);
                if (updated.compteCree && !isLoggedIn) {
                  setIsLoggedIn(true);
                  setRole('candidat');
                }
              }}
              onUpdateSujets={(newSujets) => {
                setSujets(newSujets);
                storageService.setSujets(newSujets);
              }}
              initialView="catalog"
              onNavigateTab={handleTabChange}
            />
          )}

          {/* Onglet Panier d'intérêt (Illimité) */}
          {tab === 'panier' && (
            <SujetsModule
              key="panier"
              role={role}
              sujets={sujets}
              enseignants={enseignants}
              candidat={candidat}
              onUpdateCandidat={(updated) => {
                setCandidat(updated);
                if (updated.compteCree && !isLoggedIn) {
                  setIsLoggedIn(true);
                  setRole('candidat');
                }
              }}
              onUpdateSujets={(newSujets) => {
                setSujets(newSujets);
                storageService.setSujets(newSujets);
              }}
              initialView="panier"
              onNavigateTab={handleTabChange}
            />
          )}

          {/* Onglet Enseignant : Candidatures reçues */}
          {tab === 'candidatures_recues' && (
            selectedCandidatForDossier ? (
              <DossierDirecteur
                candidatId={selectedCandidatForDossier.id}
                onRetour={() => setSelectedCandidatForDossier(null)}
                enseignantId={activeEnseignant.id}
              />
            ) : (
            <div className="space-y-3">
              <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase text-amber-300">
                    {fr.sujetsModule.teacherCandidaturesTitle}
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    {activeEnseignant.nom} ({activeEnseignant.structure})
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400">
                  {candidaturesEnseignant.length}
                </span>
              </div>

              {candidaturesEnseignant.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
                  <p className="text-xs text-slate-500">{fr.sujetsModule.teacherCandidaturesEmpty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidaturesEnseignant.map((item) => {
                    const itemCandidate = item.isCurrentCandidat
                      ? candidat
                      : (MOCK_CANDIDATS.find((c) => c.id === item.candidatId) || {
                          id: item.candidatId,
                          nom: item.candidatNom,
                          cne: item.cne,
                          pieces: [
                            { type: 'CIN', statut: item.piecesProuvees >= 1 ? 'prouvee' : 'absente' },
                            { type: 'CV', statut: item.piecesProuvees >= 2 ? 'prouvee' : 'absente' },
                            { type: 'DIPLOME', statut: item.piecesProuvees >= 3 ? 'prouvee' : 'absente', source: 'apogee' },
                          ],
                        });
                    const check = dossierComplet(itemCandidate as any);

                    return (
                      <div
                        key={item.key}
                        className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                      >
                        {/* 4. Carte candidat (onglet Candidatures) : retire le titre du sujet. Nom, date JJ/MM, une pastille d'état, "Ouvrir le dossier". */}
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{item.candidatNom}</h3>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            {formatDateJJMM(item.date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {check.complet ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={13} className="text-emerald-700 shrink-0" />
                              <span>{fr.dossierDirecteur.verdictComplet}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertCircle size={13} className="text-amber-700 shrink-0" />
                              <span>
                                {fr.dossierDirecteur.verdictIncomplet.replace('{manques}', check.manques.join(', '))}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidatForDossier({ id: item.candidatId, nom: item.candidatNom })}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition cursor-pointer flex items-center gap-1.5 active:scale-98 shadow-xs"
                          >
                            <Eye size={14} />
                            <span>{fr.dossierDirecteur.btnOuvrirDossier}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )
          )}

          {/* Onglet « Mon dossier » (candidat) */}
          {tab === 'dossier' && role === 'candidat' && isLoggedIn && (
            <Dossier onNavigate={(targetTab) => setTab(targetTab)} />
          )}

          {/* Onglet Rapport (Doctorant) */}
          {tab === 'rapport' && role === 'doctorant' && (
            <RapportComponent doctorantId="doc-nadia" initialTab="rapport" />
          )}

          {/* Onglet Suivi (Doctorant) */}
          {tab === 'suivi' && role === 'doctorant' && (
            <RapportComponent doctorantId="doc-nadia" initialTab="suivi" />
          )}

          {/* Onglet Entretiens (Candidat) */}
          {tab === 'entretiens' && role === 'candidat' && (
            <Entretiens candidat={candidat} onNavigate={handleTabChange} />
          )}

          {/* Onglet Mes créneaux (Enseignant) */}
          {tab === 'entretiens' && role === 'enseignant' && (
            <MesCreneaux enseignantId={activeEnseignant.id} />
          )}

          {/* Onglet Commission (Directeur de thèse) */}
          {tab === 'commission' && role === 'enseignant' && (
            <Commission
              enseignantId={activeEnseignant.id}
              enseignantNom={activeEnseignant.nom}
            />
          )}

          {/* Onglet Séances (Directeur CED) */}
          {tab === 'seances' && role === 'directeur_ced' && (
            <CedSeances />
          )}

          {/* Onglet Réinscriptions (Directeur de thèse / Enseignant) */}
          {tab === 'reinscriptions' && (role === 'enseignant' || (!normalizedRoles.includes('directeur_ced') && normalizedRoles.includes('enseignant'))) && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="text-emerald-700" size={24} />
                  <span>{fr.nav.reinscriptions}</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Validation des rapports d’activité des doctorants encadrés
                </p>
              </div>

              {teacherFeedbackMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{teacherFeedbackMsg}</span>
                </div>
              )}

              {rapportsDirecteur.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                  <FileText size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">{fr.dossierDirecteur.aucuneDonnee}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rapportsDirecteur.map((r) => {
                    const comment = (teacherComments[r.id] || '').trim();
                    const isCommentValid = comment.length >= 5;
                    const canActionner = r.statut === 'soumis';

                    return (
                      <div
                        key={r.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5"
                      >
                        {/* En-tête : Nom, Année, Date JJ/MM, UNE pastille d'état */}
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                                {getDoctorantNom(r.doctorantId)}
                              </h3>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {r.annee}ᵉ année
                              </span>
                            </div>
                            {r.soumisLe && (
                              <p className="text-xs text-slate-500 mt-1">
                                {fr.reinscription.dateSoumission} <span className="font-medium text-slate-700">{formatDateJJMM(r.soumisLe)}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* UNE SEULE pastille d'état */}
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                r.statut === 'valide_ced' || r.statut === 'valide_encadrant'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : r.statut === 'a_corriger'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : r.statut === 'avis_comite'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-300'
                              }`}
                            >
                              {fr.reinscription.statuts[r.statut] || fr.reinscription.statuts.soumis}
                            </span>

                            {/* Bouton Voir */}
                            <button
                              type="button"
                              onClick={() => setViewingRapport(r)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Eye size={13} className="text-slate-600" />
                              <span>{fr.reinscription.btnVoir}</span>
                            </button>
                          </div>
                        </div>

                        {/* Champ commentaire */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {fr.reinscription.commentEncadrantLabel}
                          </label>
                          <textarea
                            value={teacherComments[r.id] ?? ''}
                            onChange={(e) =>
                              setTeacherComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                            placeholder={fr.reinscription.commentEncadrantPlaceholder}
                            rows={2}
                            disabled={!canActionner}
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </div>

                        {/* Boutons Valider et À corriger */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTeacherValiderRapport(r.id)}
                              disabled={!canActionner}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <CheckCircle2 size={13} />
                              <span>{fr.reinscription.btnValider}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTeacherCorrigerRapport(r.id)}
                              disabled={!canActionner || !isCommentValid}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <RotateCcw size={13} />
                              <span>{fr.reinscription.btnAcorriger}</span>
                            </button>
                          </div>

                          {/* Raison écrite si À corriger est grisé pour commentaire insuffisant */}
                          {canActionner && !isCommentValid && (
                            <p className="text-[11px] text-amber-700 font-medium">
                              {fr.reinscription.commentMinLengthReason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Onglet Réinscriptions (Directeur CED) */}
          {tab === 'reinscriptions' && role === 'directeur_ced' && (
            <CedReinscriptions />
          )}

          {/* Onglet Exceptions CED (Directeur CED) */}
          {tab === 'ced' && (
            <Exceptions />
          )}

          {/* Onglet Vote Comité sans compte */}
          {tab === 'vote_comite' && (
            <VoteComite onClose={() => setTab('sujets')} />
          )}

          {/* Onglet Guichet (Agent Guichet) */}
          {tab === 'guichet' && role === 'agent' && (
            <Guichet />
          )}
        </>
      )}
    </main>

        {/* Pied de page sobre et discret */}
        <footer className="mt-auto px-4 py-5 border-t border-slate-100 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>{fr.footer.copyright}</span>
          <button
            type="button"
            onClick={handleResetData}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors cursor-pointer"
          >
            {fr.footer.resetDemo}
          </button>
        </footer>

        {/* Barre de navigation mobile inférieure tactile (5 max + Plus) via MobileNav */}
        <MobileNav
          currentTab={tab}
          onTabChange={handleTabChange}
          isLoggedIn={isLoggedIn}
          role={role}
          roles={userRoles}
          userName={currentUserName}
          userEmail={currentUserEmail}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          onReset={handleResetData}
          badgeCounts={{
            candidaturesCount: candidaturesCompletsNonValidesCount,
            piecesPretes: piecesAProverCount,
            alertesCed: alertesCreneaux.length,
            reinscriptionsCount: rapportsAValider.length,
          }}
        />

        {/* Menu Compte Mobile (Feuille tiroir) */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="bg-white rounded-t-2xl p-4 space-y-3 shadow-2xl border-t border-slate-200 max-w-md mx-auto w-full animate-in slide-in-from-bottom-6 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-slate-900 break-all">
                      {isLoggedIn ? (currentUserEmail || fr.auth.accountMenu) : 'Visiteur démo'}
                    </p>
                    {!isLoggedIn && (
                      <span className="text-[10px] font-semibold text-slate-500">Non connecté</span>
                    )}
                    {isLoggedIn && role === 'enseignant' && (
                      <div className="mt-1 pt-1 border-t border-slate-100">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                          {fr.auth.profileStructureLabel}
                        </span>
                        <span className="text-[11px] font-medium text-slate-700 break-words block">
                          {activeEnseignant.structure}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Date de démo */}
              <div
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="demo-date-mobile" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-500" />
                    <span>{fr.demoDate.label}</span>
                  </label>
                  {Boolean(demoDateInput) && (
                    <button
                      type="button"
                      onClick={handleResetDemoDate}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      {fr.demoDate.reset}
                    </button>
                  )}
                </div>
                <input
                  id="demo-date-mobile"
                  type="date"
                  value={demoDateInput || aujourdhui()}
                  onChange={(e) => handleDemoDateChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {!isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsLoginOpen(true);
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
                >
                  <LogIn size={15} className="text-emerald-700" />
                  <span>{fr.auth.login}</span>
                </button>
              )}

              {isLoggedIn && normalizedRoles.includes('enseignant') && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleTabChange('reinscriptions');
                  }}
                  className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                    tab === 'reinscriptions'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Award size={15} className={tab === 'reinscriptions' ? 'text-emerald-700' : 'text-slate-500'} />
                    <span>{fr.nav.reinscriptions}</span>
                  </div>
                  {rapportsAValider.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                      {rapportsAValider.length}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleResetData();
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw size={15} className="text-slate-500" />
                <span>{fr.nav.resetData}</span>
              </button>

              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center gap-2.5 text-xs font-semibold cursor-pointer"
                >
                  <LogOut size={15} className="text-rose-600" />
                  <span>{fr.auth.logout}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {fr.common.close}
              </button>
            </div>
          </div>
        )}



        {/* Modale de connexion / identification du rôle */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          restrictionMessage={restrictionMsg}
          onRequestCreateAccount={() => {
            setIsLoginOpen(false);
            setTab('panier');
          }}
          onOpenVoteComite={() => {
            setIsLoginOpen(false);
            setTab('vote_comite');
          }}
        />

        {/* Visionneuse de document (PDF en iframe + Ouvrir dans un nouvel onglet, ou ancien rapport) */}
        {viewingRapport && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {fr.reinscription.apercuRapport} — {getDoctorantNom(viewingRapport.doctorantId)} ({viewingRapport.annee}ᵉ année)
                </h3>
                {viewingRapport.fichierPdf && isPdfData(viewingRapport.fichierPdf) && (
                  <button
                    type="button"
                    onClick={() => openPdfInNewTab(viewingRapport.fichierPdf!)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <ExternalLink size={13} />
                    <span>{fr.dossierDirecteur.ouvrirNouvelOnglet}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewingRapport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-2"
                aria-label={fr.dossierDirecteur.fermerApercu}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
              {viewingRapport.fichierPdf && isPdfData(viewingRapport.fichierPdf) ? (
                <iframe
                  src={viewingRapport.fichierPdf}
                  title={viewingRapport.nomFichier || 'Rapport PDF'}
                  className="w-full h-full min-h-[75vh] rounded-xl bg-white border border-slate-800 shadow-xl"
                />
              ) : (viewingRapport.avancement || viewingRapport.titre || (viewingRapport.publications && viewingRapport.publications.length > 0)) ? (
                <div className="w-full max-w-2xl bg-white text-slate-800 rounded-xl p-6 shadow-xl max-h-[80vh] overflow-y-auto space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">{viewingRapport.annee}ᵉ année de doctorat</span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">{viewingRapport.titre}</h4>
                  </div>
                  {viewingRapport.avancement && (
                    <div>
                      <span className="text-xs font-bold text-slate-900">{fr.reinscription.avancementLabel} :</span>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{viewingRapport.avancement}</p>
                    </div>
                  )}
                  {viewingRapport.publications && viewingRapport.publications.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-900">{fr.reinscription.publicationsSectionTitle} :</span>
                      <ul className="list-disc list-inside text-xs text-slate-600 mt-1 space-y-1">
                        {viewingRapport.publications.map((p, i) => (
                          <li key={i}>{p.titre} {p.doi && <span className="text-[11px] text-slate-400 font-mono">({p.doi})</span>}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewingRapport.communications && viewingRapport.communications.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-900">{fr.reinscription.communicationsSectionTitle} :</span>
                      <ul className="list-disc list-inside text-xs text-slate-600 mt-1 space-y-1">
                        {viewingRapport.communications.map((c, i) => (
                          <li key={i}>{c.titre} {c.lieu && <span className="text-[11px] text-slate-400">({c.lieu})</span>}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewingRapport.formationsHeures > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-900">{fr.reinscription.formationsHoursLabel} :</span>
                      <p className="text-xs text-slate-600 mt-0.5">{viewingRapport.formationsHeures} h</p>
                    </div>
                  )}
                  {viewingRapport.perspectives && (
                    <div>
                      <span className="text-xs font-bold text-slate-900">{fr.reinscription.perspectivesLabel} :</span>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{viewingRapport.perspectives}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-900 rounded-2xl text-slate-400 font-medium border border-slate-800">
                  <p>{fr.dossierDirecteur.aucuneDonnee}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
