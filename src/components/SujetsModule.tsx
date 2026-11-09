import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Heart,
  Trash2,
  Check,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Filter,
  CheckCircle2,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileCheck2,
  Stethoscope,
  Cpu,
  Cog,
  BookOpen,
  GraduationCap,
  KeyRound,
  Clock,
  XCircle,
  Eye,
  Calendar,
  Plus,
  Archive,
} from 'lucide-react';
import { Sujet, Candidat, Enseignant, UserRole, Notification, dossierComplet, Periode, QUOTA_SUJETS } from '../types';
import { fr } from '../i18n/fr';
import { storageService } from '../services/storage';
import { StatusBadge } from './StatusBadge';
import { AdvancedSearchModal, AdvancedFilterCriteria } from './AdvancedSearchModal';
import { normalizeText } from './Autocomplete';
import { normaliserTel } from '../utils/messages';
import { logEvent } from '../utils/journal';
import { MOCK_CANDIDATS, getPeriodeCandidature } from '../data/mockData';

const getDisciplineConfig = (discipline: string) => {
  const norm = discipline
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('medecine') || norm.includes('biotechnologie')) {
    return {
      Icon: Stethoscope,
      barColor: 'bg-emerald-600',
      iconPill: 'bg-emerald-100 text-emerald-800',
      badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      cardBg: 'bg-emerald-50',
      cardBorder: 'border-emerald-200',
    };
  }
  if (norm.includes('informatique') || norm.includes('telecom')) {
    return {
      Icon: Cpu,
      barColor: 'bg-blue-600',
      iconPill: 'bg-blue-100 text-blue-800',
      badge: 'bg-blue-50 text-blue-900 border-blue-200',
      cardBg: 'bg-blue-50',
      cardBorder: 'border-blue-200',
    };
  }
  if (norm.includes('ingenieur') || norm.includes('technique')) {
    return {
      Icon: Cog,
      barColor: 'bg-orange-500',
      iconPill: 'bg-orange-100 text-orange-800',
      badge: 'bg-orange-50 text-orange-900 border-orange-200',
      cardBg: 'bg-orange-50',
      cardBorder: 'border-orange-200',
    };
  }
  if (norm.includes('lettre') || norm.includes('humaine')) {
    return {
      Icon: BookOpen,
      barColor: 'bg-purple-600',
      iconPill: 'bg-purple-100 text-purple-800',
      badge: 'bg-purple-50 text-purple-900 border-purple-200',
      cardBg: 'bg-purple-50',
      cardBorder: 'border-purple-200',
    };
  }
  return {
    Icon: GraduationCap,
    barColor: 'bg-slate-500',
    iconPill: 'bg-slate-100 text-slate-700',
    badge: 'bg-slate-50 text-slate-800 border-slate-200',
    cardBg: 'bg-slate-50',
    cardBorder: 'border-slate-200',
  };
};

interface SujetsModuleProps {
  role: UserRole | string;
  sujets: Sujet[];
  enseignants: Enseignant[];
  candidat: Candidat;
  onUpdateCandidat: (updated: Candidat) => void;
  initialView?: 'catalog' | 'panier';
  onRequestLogin?: () => void;
  onNavigateTab?: (tab: 'sujets' | 'panier' | 'dossier') => void;
  onUpdateSujets?: (newSujets: Sujet[]) => void;
}

type InternalView = 'catalog' | 'panier' | 'register' | 'verify_code' | 'select3' | 'confirmation';

export const SujetsModule: React.FC<SujetsModuleProps> = ({
  role,
  sujets,
  enseignants,
  candidat,
  onUpdateCandidat,
  initialView = 'catalog',
  onRequestLogin,
  onNavigateTab,
  onUpdateSujets,
}) => {
  const [view, setView] = useState<InternalView>(initialView);

  // Synchronisation si initialView change depuis la barre de navigation
  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Période de candidature
  const [periode, setPeriode] = useState<Periode>(() => getPeriodeCandidature());

  React.useEffect(() => {
    const handlePeriodeUpdate = () => {
      setPeriode(getPeriodeCandidature());
    };
    window.addEventListener('usmba_periode_updated', handlePeriodeUpdate);
    window.addEventListener('storage', handlePeriodeUpdate);
    return () => {
      window.removeEventListener('usmba_periode_updated', handlePeriodeUpdate);
      window.removeEventListener('storage', handlePeriodeUpdate);
    };
  }, []);

  // Recherche globale, tri et pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'titre' | 'structure'>('titre');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Critères de recherche avancée (ET logique)
  const [advancedCriteria, setAdvancedCriteria] = useState<AdvancedFilterCriteria>({
    encadrant: '',
    discipline: '',
    structure: '',
    keywords: [],
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Dépliage accordéon sur place (sans pop-up)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Alerte 4e sujet refusé
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulaire d'inscription avec mot de passe
  const [form, setForm] = useState({
    nom: '',
    email: '',
    tel: '',
    motDePasse: '',
    confirmerMotDePasse: '',
  });
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);

  // Vérification de compte (code SMS simulé)
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyCodeError, setVerifyCodeError] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Attestation sur l'honneur pour l'étape "Choisis tes 3 sujets"
  const [certifieHonneur, setCertifieHonneur] = useState(false);

  // Sélection temporaire pour l'étape "Choisis tes 3 sujets"
  const [tempSelection, setTempSelection] = useState<string[]>(
    candidat.candidatures && candidat.candidatures.length > 0
      ? candidat.candidatures
      : candidat.panier.slice(0, 3)
  );

  // État spécifique pour le directeur de thèse (Gestion de « Mes sujets »)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSujetTitre, setNewSujetTitre] = useState('');
  const [newSujetDiscipline, setNewSujetDiscipline] = useState('');
  const [newSujetResume, setNewSujetResume] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [sujetToDelete, setSujetToDelete] = useState<Sujet | null>(null);

  const activeTeacher = useMemo(() => {
    try {
      const rawAcc = localStorage.getItem('usmba_active_account');
      if (rawAcc) {
        const acc = JSON.parse(rawAcc);
        if (acc?.email) {
          const match = enseignants.find(
            (e) => e.email.toLowerCase() === acc.email.toLowerCase()
          );
          if (match) return match;
        }
      }
    } catch {}
    return (
      enseignants.find((e) => e.role === 'enseignant' || e.id === 'ens-1') ||
      enseignants[0] || {
        id: 'ens-1',
        nom: 'Pr. Karim El Amrani',
        email: 'prof@demo.ma',
        structure: 'LISAC - FSDM Fès',
      }
    );
  }, [enseignants]);

  // Tous les candidats connus pour calculer précisément candidatures et paniers
  const allCandidates = useMemo(() => {
    const map = new Map<string, Candidat>();
    MOCK_CANDIDATS.forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    if (candidat && candidat.id) {
      map.set(candidat.id, candidat);
    }
    return Array.from(map.values());
  }, [candidat]);

  const getCandidaturesCount = (sujetId: string): number => {
    let count = 0;
    allCandidates.forEach((c) => {
      if (Array.isArray(c?.candidatures) && c.candidatures.includes(sujetId)) {
        count++;
      }
    });
    return count;
  };

  const getPaniersCount = (sujetId: string): number => {
    let count = 0;
    allCandidates.forEach((c) => {
      if (Array.isArray(c?.panier) && c.panier.includes(sujetId)) {
        count++;
      }
    });
    return count;
  };

  const DISCIPLINES_DISPONIBLES = [
    'Sciences et Techniques de l’Ingénieur',
    'Informatique & Télécoms',
    'Sciences Physiques & Matériaux',
    'Médecine & Biotechnologie',
    'Droit & Économie',
    'Lettres & Sciences Humaines',
    'Biologie & Environnement',
  ];

  // Gestion de l'ajout d'un sujet (Quota max = QUOTA_SUJETS)
  const handleCreateSujet = (e: React.FormEvent) => {
    e.preventDefault();
    const teacherActiveCount = sujets.filter(
      (s) => s.enseignantId === activeTeacher.id && s.statut !== 'archive'
    ).length;

    if (teacherActiveCount >= QUOTA_SUJETS) {
      setAddError(fr.mesSujets.quotaAtteint);
      return;
    }

    if (!newSujetTitre.trim() || !newSujetDiscipline.trim()) {
      setAddError(fr.mesSujets.validationChampsRequis);
      return;
    }

    const created: Sujet = {
      id: `suj-${Date.now()}`,
      titre: newSujetTitre.trim(),
      discipline: newSujetDiscipline.trim(),
      motsCles: [],
      enseignantId: activeTeacher.id,
      structure: activeTeacher.structure,
      descriptionCourte: newSujetResume.trim() || undefined,
      statut: 'actif',
    };

    const updated = [created, ...sujets];
    onUpdateSujets?.(updated);
    storageService.setSujets(updated);

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      'Création sujet de thèse',
      created.titre
    );

    setIsAddModalOpen(false);
    setNewSujetTitre('');
    setNewSujetDiscipline('');
    setNewSujetResume('');
    setAddError(null);
    setActionFeedback(fr.mesSujets.sujetCreeSucces);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Suppression définitive (aucune candidature ni panier)
  const handleConfirmDelete = () => {
    if (!sujetToDelete) return;
    const updated = sujets.filter((s) => s.id !== sujetToDelete.id);
    onUpdateSujets?.(updated);
    storageService.setSujets(updated);

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      'Suppression définitive de sujet',
      sujetToDelete.titre
    );

    setSujetToDelete(null);
    setActionFeedback(fr.mesSujets.sujetSupprimeSucces);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Retrait du catalogue (paniers seulement -> statut archive, panier affichera "Plus disponible")
  const handleRetirerSujet = (sujet: Sujet) => {
    const updated = sujets.map((s) =>
      s.id === sujet.id ? { ...s, statut: 'archive' as const } : s
    );
    onUpdateSujets?.(updated);
    storageService.setSujets(updated);

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      'Retrait sujet du catalogue',
      sujet.titre
    );

    setActionFeedback(fr.mesSujets.sujetArchiveSucces);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Archivage (au moins une candidature -> statut archive, candidatures conservées)
  const handleArchiverSujet = (sujet: Sujet) => {
    const updated = sujets.map((s) =>
      s.id === sujet.id ? { ...s, statut: 'archive' as const } : s
    );
    onUpdateSujets?.(updated);
    storageService.setSujets(updated);

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      'Archivage sujet avec candidatures conservées',
      sujet.titre
    );

    setActionFeedback(fr.mesSujets.sujetArchiveSucces);
    setTimeout(() => setActionFeedback(null), 3000);
  };





  const getEnseignant = (id: string) => enseignants.find((e) => e.id === id);

  // Listes pour autocomplétion
  const encadrantOptions = useMemo(
    () => Array.from(new Set(enseignants.map((e) => e.nom))),
    [enseignants]
  );
  const disciplineOptions = useMemo(
    () => Array.from(new Set(sujets.map((s) => s.discipline))),
    [sujets]
  );
  const structureOptions = useMemo(
    () => Array.from(new Set(sujets.map((s) => s.structure))),
    [sujets]
  );
  const keywordOptions = useMemo(
    () => Array.from(new Set(sujets.flatMap((s) => s.motsCles))),
    [sujets]
  );

  // Nombre de critères actifs
  const activeCriteriaCount = useMemo(() => {
    let count = 0;
    if (advancedCriteria.encadrant.trim()) count++;
    if (advancedCriteria.discipline.trim()) count++;
    if (advancedCriteria.structure.trim()) count++;
    count += advancedCriteria.keywords.length;
    return count;
  }, [advancedCriteria]);

  // Filtrage combiné (ET logique) et Tri
  const filteredSujets = useMemo(() => {
    const normSearch = normalizeText(searchQuery);
    const normEncadrant = normalizeText(advancedCriteria.encadrant);
    const normDiscipline = normalizeText(advancedCriteria.discipline);
    const normStructure = normalizeText(advancedCriteria.structure);

    return sujets
      .filter((s) => {
        if (!s) return false;
        // Un sujet archivé disparaît du catalogue
        if (s.statut === 'archive') return false;

        const ens = getEnseignant(s.enseignantId);
        const ensNomNorm = ens ? normalizeText(ens.nom) : '';
        const sTitreNorm = normalizeText(s.titre);
        const sDiscNorm = normalizeText(s.discipline);
        const sStructNorm = normalizeText(s.structure);
        const sKeywordsNorm = s.motsCles.map((k) => normalizeText(k));

        // 1. Recherche globale directe (titre, mots-clés, encadrant)
        if (normSearch) {
          const matchGlobal =
            sTitreNorm.includes(normSearch) ||
            ensNomNorm.includes(normSearch) ||
            sKeywordsNorm.some((k) => k.includes(normSearch)) ||
            sDiscNorm.includes(normSearch) ||
            sStructNorm.includes(normSearch);
          if (!matchGlobal) return false;
        }

        // 2. Filtres avancés combinés (ET logique)
        if (normEncadrant && !ensNomNorm.includes(normEncadrant)) {
          return false;
        }
        if (normDiscipline && !sDiscNorm.includes(normDiscipline)) {
          return false;
        }
        if (normStructure && !sStructNorm.includes(normStructure)) {
          return false;
        }
        if (advancedCriteria.keywords.length > 0) {
          const allKeywordsMatch = advancedCriteria.keywords.every((kw) => {
            const normKw = normalizeText(kw);
            return sKeywordsNorm.some((k) => k.includes(normKw));
          });
          if (!allKeywordsMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'structure') {
          return a.structure.localeCompare(b.structure);
        }
        return a.titre.localeCompare(b.titre);
      });
  }, [sujets, searchQuery, advancedCriteria, sortBy, enseignants]);

  // Pagination (6 par page)
  const totalPages = Math.ceil(filteredSujets.length / itemsPerPage) || 1;
  const paginatedSujets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSujets.slice(start, start + itemsPerPage);
  }, [filteredSujets, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setAdvancedCriteria({
      encadrant: '',
      discipline: '',
      structure: '',
      keywords: [],
    });
    setSortBy('titre');
    setCurrentPage(1);
  };

  // Toggle du panier d'intérêt (illimité)
  const toggleCart = (sujetId: string) => {
    const inCart = candidat.panier.includes(sujetId);
    const newPanier = inCart
      ? candidat.panier.filter((id) => id !== sujetId)
      : [...candidat.panier, sujetId];

    const updated: Candidat = {
      ...candidat,
      panier: newPanier,
      panierInteret: newPanier,
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);
  };

  // Connexion démo
  const handleLoginDemo = () => {
    const demo = storageService.loginAsDemo();
    onUpdateCandidat(demo);
    setTempSelection(demo.candidatures);
  };

  // Déconnexion (retour visiteur)
  const handleLogout = () => {
    const visitor: Candidat = {
      id: 'visiteur-001',
      nom: '',
      cne: '',
      cin: '',
      email: '',
      tel: '',
      panier: candidat.panier, // conserve le panier local
      candidatures: [],
      compteCree: false,
    };
    onUpdateCandidat(visitor);
    storageService.setCandidat(visitor);
  };

  // Timer de déblocage pour la saisie du code SMS
  React.useEffect(() => {
    const checkLockout = () => {
      if (candidat.verificationBloqueJusqua && candidat.verificationBloqueJusqua > Date.now()) {
        const remaining = Math.ceil((candidat.verificationBloqueJusqua - Date.now()) / 1000);
        setLockoutRemaining(remaining);
      } else {
        setLockoutRemaining(0);
        if (candidat.verificationBloqueJusqua && candidat.verificationBloqueJusqua <= Date.now()) {
          const updated: Candidat = {
            ...candidat,
            verificationEssaisRestants: 3,
            verificationBloqueJusqua: 0,
          };
          onUpdateCandidat(updated);
          storageService.setCandidat(updated);
        }
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [candidat.verificationBloqueJusqua, candidat, onUpdateCandidat]);

  // Clic sur "Candidater"
  const handleStartCandidater = () => {
    setErrorMsg(null);
    if (!candidat.compteCree) {
      setView('register');
    } else if (candidat.verificationStatut === 'non_verifie') {
      setView('verify_code');
    } else {
      setTempSelection(
        candidat.candidatures.length > 0
          ? candidat.candidatures
          : candidat.panier.slice(0, Math.min(3, candidat.panier.length))
      );
      setView('select3');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.email.trim() || !form.tel.trim()) {
      setFormValidationMsg(fr.sujetsModule.validationRequired);
      return;
    }
    const cleanTel = form.tel.trim().replace(/[\s.-]/g, '');
    const isZero10Digits = /^0[0-9]{9}$/.test(cleanTel);
    const isPlus212_9Digits = /^\+212[0-9]{9}$/.test(cleanTel);
    if (!isZero10Digits && !isPlus212_9Digits) {
      setFormValidationMsg(fr.sujetsModule.validationTelError);
      return;
    }
    if (!form.motDePasse) {
      setFormValidationMsg(fr.sujetsModule.passwordRequired);
      return;
    }
    if (form.motDePasse.length < 6) {
      setFormValidationMsg(fr.sujetsModule.passwordTooShort);
      return;
    }
    if (form.motDePasse !== form.confirmerMotDePasse) {
      setFormValidationMsg(fr.sujetsModule.passwordMismatch);
      return;
    }

    // Démo : unicité et code locaux ; en production, serveur, anti-robot et API Apogée
    const cleanEmail = form.email.trim().toLowerCase();
    const normSubmittedTel = normaliserTel(form.tel);

    // Rassembler tous les comptes existants pour tester l'unicité
    let existingAccounts: Candidat[] = [...MOCK_CANDIDATS];
    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      if (rawAccounts) {
        const stored: Candidat[] = JSON.parse(rawAccounts);
        existingAccounts = [...existingAccounts, ...stored];
      }
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (cur.compteCree && cur.id !== candidat.id) {
          existingAccounts.push(cur);
        }
      }
    } catch {
      // safe fallback
    }

    const isDuplicate = existingAccounts.some((acc) => {
      // Unicité e-mail
      if (acc.email && acc.email.trim().toLowerCase() === cleanEmail) {
        return true;
      }
      // Unicité téléphone normalisé
      if (normSubmittedTel && acc.tel) {
        const accNormTel = normaliserTel(acc.tel);
        if (accNormTel && accNormTel === normSubmittedTel) {
          return true;
        }
      }
      // Unicité CNE (quand il existe)
      if (candidat.cne && acc.cne && candidat.cne.trim().toUpperCase() === acc.cne.trim().toUpperCase()) {
        return true;
      }
      // Unicité CIN (quand il existe)
      if (candidat.cin && acc.cin && candidat.cin.trim().toUpperCase() === acc.cin.trim().toUpperCase()) {
        return true;
      }
      return false;
    });

    if (isDuplicate) {
      setFormValidationMsg(fr.sujetsModule.compteExisteDeja);
      return;
    }

    setFormValidationMsg(null);

    // Génération d'un code à 6 chiffres via crypto.getRandomValues
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const verificationCode = String(100000 + (randomArray[0] % 900000));
    const newCandId = `cand-${Date.now()}`;

    // Notification SMS simulé
    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      const notifs: Notification[] = rawNotifs ? JSON.parse(rawNotifs) : [];
      const newNotif: Notification = {
        id: `notif-sms-${Date.now()}`,
        destinataireId: newCandId,
        texte: `SMS simulé : Votre code de vérification USMBA est ${verificationCode}`,
        date: new Date().toISOString(),
        lue: false,
        canal: 'sms',
      };
      notifs.unshift(newNotif);
      localStorage.setItem('usmba_notifications', JSON.stringify(notifs));
      window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    } catch {
      // safe fallback
    }

    const updated: Candidat = {
      ...candidat,
      id: newCandId,
      nom: form.nom.trim(),
      email: form.email.trim(),
      tel: form.tel.trim(),
      motDePasse: form.motDePasse,
      compteCree: true,
      verificationStatut: 'non_verifie',
      verificationCode,
      verificationEssaisRestants: 3,
      verificationBloqueJusqua: 0,
      panier: candidat.panier,
      candidatures: [],
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);

    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
      const filtered = accounts.filter(
        (a) => a.email.toLowerCase().trim() !== updated.email.toLowerCase().trim()
      );
      filtered.push(updated);
      localStorage.setItem('usmba_registered_accounts', JSON.stringify(filtered));
    } catch {
      // safe fallback
    }

    setVerifyCodeInput('');
    setVerifyCodeError(null);
    setView('verify_code');
  };

  // Soumission du code de vérification SMS
  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    const trimmedInput = verifyCodeInput.trim();
    const expectedCode = candidat.verificationCode?.trim();

    if (expectedCode && trimmedInput === expectedCode) {
      // Code correct : validation du compte
      const updated: Candidat = {
        ...candidat,
        verificationStatut: 'verifie',
        verificationCode: undefined,
        verificationEssaisRestants: 3,
        verificationBloqueJusqua: 0,
      };
      onUpdateCandidat(updated);
      storageService.setCandidat(updated);

      try {
        const rawAccounts = localStorage.getItem('usmba_registered_accounts');
        const accounts: Candidat[] = rawAccounts ? JSON.parse(rawAccounts) : [];
        const updatedAccounts = accounts.map((a) =>
          a.id === updated.id || a.email.toLowerCase() === updated.email.toLowerCase() ? updated : a
        );
        localStorage.setItem('usmba_registered_accounts', JSON.stringify(updatedAccounts));
      } catch {
        // safe fallback
      }

      setTempSelection(candidat.panier.slice(0, Math.min(3, candidat.panier.length)));
      setView('select3');
    } else {
      // Code incorrect
      const currentAttempts = candidat.verificationEssaisRestants ?? 3;
      const nextAttempts = currentAttempts - 1;

      if (nextAttempts <= 0) {
        // Blocage de 1 minute
        const lockUntil = Date.now() + 60000;
        const updated: Candidat = {
          ...candidat,
          verificationEssaisRestants: 0,
          verificationBloqueJusqua: lockUntil,
        };
        onUpdateCandidat(updated);
        storageService.setCandidat(updated);
        setLockoutRemaining(60);
        setVerifyCodeError(fr.sujetsModule.codeBloque);
      } else {
        const updated: Candidat = {
          ...candidat,
          verificationEssaisRestants: nextAttempts,
        };
        onUpdateCandidat(updated);
        storageService.setCandidat(updated);
        setVerifyCodeError(
          fr.sujetsModule.codeInvalide.replace('{essais}', String(nextAttempts))
        );
      }
    }
  };

  // Renvoyer un nouveau code par SMS simulé
  const handleResendCode = () => {
    if (lockoutRemaining > 0) return;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const newCode = String(100000 + (array[0] % 900000));

    const updated: Candidat = {
      ...candidat,
      verificationCode: newCode,
      verificationEssaisRestants: 3,
      verificationBloqueJusqua: 0,
      verificationStatut: 'non_verifie',
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);

    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      const notifs: Notification[] = rawNotifs ? JSON.parse(rawNotifs) : [];
      const newNotif: Notification = {
        id: `notif-sms-${Date.now()}`,
        destinataireId: updated.id,
        texte: `SMS simulé : Votre code de vérification USMBA est ${newCode}`,
        date: new Date().toISOString(),
        lue: false,
        canal: 'sms',
      };
      notifs.unshift(newNotif);
      localStorage.setItem('usmba_notifications', JSON.stringify(notifs));
      window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    } catch {
      // safe fallback
    }

    setVerifyCodeError(null);
    setVerifyCodeInput('');
  };

  // Sélection dans "Choisis tes 3 sujets"
  const toggleSelectForCandidate = (id: string) => {
    setErrorMsg(null);
    if (tempSelection.includes(id)) {
      setTempSelection(tempSelection.filter((x) => x !== id));
    } else {
      if (tempSelection.length >= 3) {
        // 4e sujet refusé
        setErrorMsg(fr.sujetsModule.fourthRefusedAlert);
        return;
      }
      setTempSelection([...tempSelection, id]);
    }
  };

  // Retirer automatiquement du panier les sujets déjà candidatés
  React.useEffect(() => {
    if (candidat.candidatures && candidat.candidatures.length > 0) {
      const hasOverlap = candidat.panier.some((id) => candidat.candidatures.includes(id));
      if (hasOverlap) {
        const cleanedPanier = candidat.panier.filter((id) => !candidat.candidatures.includes(id));
        const updated: Candidat = {
          ...candidat,
          panier: cleanedPanier,
          panierInteret: cleanedPanier,
        };
        onUpdateCandidat(updated);
        storageService.setCandidat(updated);
      }
    }
  }, [candidat.candidatures, candidat.panier, onUpdateCandidat]);

  // Validation finale des candidatures avec enregistrement en brouillon (Règle 2)
  const handleValidateCandidatures = () => {
    // Retirer les sujets candidatés du panier
    const remainingPanier = candidat.panier.filter((id) => !tempSelection.includes(id));
    const nowIso = new Date().toISOString();
    const statuts: Record<string, any> = {
      ...(candidat.candidaturesStatuts || {}),
    };
    tempSelection.forEach((id) => {
      statuts[id] = 'brouillon';
    });
    const updated: Candidat = {
      ...candidat,
      panier: remainingPanier,
      panierInteret: remainingPanier,
      candidatures: tempSelection,
      interets: tempSelection,
      candidaturesStatuts: statuts,
      attesteLe: nowIso,
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);
    logEvent(
      { id: candidat.id, nom: candidat.nom, role: 'candidat' },
      fr.journalActions.candidatureDeposee,
      `${tempSelection.length} sujet(s)`
    );

    // Règle 4 : Supprime la notification automatique au dépôt
    setView('confirmation');
  };

  // Sujets du panier (sécurisé contre les sujets introuvables / supprimés)
  const cartItems = useMemo(() => {
    const panierIds = Array.isArray(candidat?.panier) ? candidat.panier : [];
    return panierIds
      .map((id) => sujets.find((s) => s && s.id === id))
      .filter((s): s is Sujet => Boolean(s));
  }, [candidat?.panier, sujets]);

  const candidateItems = useMemo(() => {
    const candidaturesIds = Array.isArray(candidat?.candidatures) ? candidat.candidatures : [];
    return candidaturesIds
      .map((id) => sujets.find((s) => s && s.id === id))
      .filter((s): s is Sujet => Boolean(s));
  }, [candidat?.candidatures, sujets]);

  // Sujets disponibles dans le panier (non archivés)
  const cartAvailableItems = useMemo(() => {
    return cartItems.filter((s) => s.statut !== 'archive');
  }, [cartItems]);

  // Règle du bouton Valider : actif seulement à 3 exactement, ou moins si panier disponible < 3
  const isValidateActive =
    cartAvailableItems.length >= 3
      ? tempSelection.length === 3
      : tempSelection.length === cartAvailableItems.length;

  /* ========================================================================= */
  /* VUE 4 : CONFIRMATION DES CANDIDATURES DÉPOSÉES EN BROUILLON               */
  /* ========================================================================= */
  if (view === 'confirmation') {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-1.5">
          <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">
            {fr.sujetsModule.confirmationBrouillonTitle}
          </h2>
          <p className="text-xs text-slate-600 font-medium">
            {fr.sujetsModule.confirmationBrouillonSub}
          </p>
        </div>

        {/* Boutons d'action : "Compléter mon dossier" et "Plus tard" */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setView('catalog');
              onNavigateTab?.('dossier');
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText size={16} />
            <span>{fr.sujetsModule.btnCompleterMonDossier}</span>
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setView('catalog');
              onNavigateTab?.('sujets');
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer text-center"
          >
            <span>{fr.sujetsModule.btnPlusTard}</span>
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {candidateItems.map((sujet) => (
            <div key={sujet.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {sujet.discipline}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  <FileText size={12} className="text-slate-500" />
                  <span>{fr.sujetsModule.candidatureBrouillonBadge}</span>
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{sujet.titre}</h4>
              <p className="text-[11px] text-slate-500">{sujet.structure}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 3 : ÉCRAN "CHOISIS TES 3 SUJETS"                                       */
  /* ========================================================================= */
  if (view === 'select3') {
    return (
      <div className="space-y-3.5">
        <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase text-amber-300">{fr.sujetsModule.choose3Title}</h2>
            <p className="text-[11px] text-slate-300">{fr.sujetsModule.choose3Sub}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950">
            {fr.sujetsModule.counterFormat.replace('{count}', String(tempSelection.length))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          {cartItems.map((sujet) => {
            const isChecked = tempSelection.includes(sujet.id);
            const isArchived = sujet.statut === 'archive';
            const { Icon: DisciplineIcon, iconPill, badge: badgeColor } = getDisciplineConfig(sujet.discipline);

            if (isArchived) {
              return (
                <div
                  key={sujet.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 select-none opacity-75"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border border-slate-300 bg-slate-100 text-slate-400">
                      <X size={12} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-700">
                          {sujet.discipline}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} className="text-amber-700 shrink-0" />
                          <span>{fr.sujetsModule.plusDisponible}</span>
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-500 leading-snug">{sujet.titre}</h4>
                      <p className="text-[11px] text-slate-400">{sujet.structure}</p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={sujet.id}
                onClick={() => toggleSelectForCandidate(sujet.id)}
                className={`p-3 rounded-xl border cursor-pointer select-none transition ${
                  isChecked
                    ? 'bg-emerald-50/70 border-emerald-400 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                      isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check size={13} />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${iconPill}`} aria-hidden="true">
                        <DisciplineIcon size={11} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                        {sujet.discipline}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{sujet.titre}</h4>
                    <p className="text-[11px] text-slate-600">{sujet.structure}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 space-y-2.5">
          {/* Case obligatoire Attestation sur l'honneur */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 shadow-xs">
            <label className="flex items-start gap-2.5 text-xs text-amber-950 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={certifieHonneur}
                onChange={(e) => setCertifieHonneur(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-amber-300 cursor-pointer shrink-0"
              />
              <span className="leading-snug">{fr.sujetsModule.attestationHonneurLabel}</span>
            </label>
          </div>

          {!isValidateActive && (
            <p className="text-[11px] text-amber-800 text-center font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
              {fr.sujetsModule.exact3Notice}
            </p>
          )}

          <button
            type="button"
            disabled={!isValidateActive || !certifieHonneur}
            onClick={handleValidateCandidatures}
            className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
              isValidateActive && certifieHonneur
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check size={16} />
            <span>{fr.sujetsModule.btnValiderCandidatures}</span>
          </button>

          {isValidateActive && !certifieHonneur && (
            <p className="text-[11px] text-amber-800 text-center font-medium">
              {fr.sujetsModule.attestationHonneurRequired}
            </p>
          )}

          <button
            type="button"
            onClick={() => setView('panier')}
            className="w-full py-2 text-xs text-slate-600 hover:underline text-center cursor-pointer"
          >
            {fr.common.back}
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 2 : FORMULAIRE DE CRÉATION DE COMPTE (5 CHAMPS MAX)                   */
  /* ========================================================================= */
  if (view === 'register') {
    return (
      <div className="space-y-3.5">
        <div className="bg-slate-900 text-white rounded-xl p-3.5">
          <h2 className="text-xs font-bold uppercase text-amber-300">{fr.sujetsModule.accountFormTitle}</h2>
          <p className="text-[11px] text-slate-300 mt-0.5">{fr.sujetsModule.accountFormSub}</p>
        </div>

        {formValidationMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
            {formValidationMsg}
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.nameLabel} *</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>


          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.emailLabel} *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.telLabel} *</label>
            <input
              type="tel"
              value={form.tel}
              onChange={(e) => setForm({ ...form, tel: e.target.value })}
              placeholder={fr.sujetsModule.telPlaceholder}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                {fr.sujetsModule.passwordLabel} *
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="••••••••"
                value={form.motDePasse}
                onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                {fr.sujetsModule.confirmPasswordLabel} *
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="••••••••"
                value={form.confirmerMotDePasse}
                onChange={(e) => setForm({ ...form, confirmerMotDePasse: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full min-h-[46px] py-2.5 rounded-xl font-bold text-xs bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-xs"
            >
              {fr.sujetsModule.btnSubmitAccount}
            </button>
            <button
              type="button"
              onClick={() => setView('panier')}
              className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 text-center"
            >
              {fr.common.cancel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 2b : VÉRIFICATION DU CODE SMS SIMULÉ (6 CHIFFRES)                     */
  /* ========================================================================= */
  if (view === 'verify_code') {
    const isLocked = lockoutRemaining > 0;
    return (
      <div className="space-y-3.5 max-w-md mx-auto">
        <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-amber-400" />
            <h2 className="text-xs font-bold uppercase text-amber-300">
              {fr.sujetsModule.codeVerificationTitle}
            </h2>
          </div>
          <p className="text-[11px] text-slate-300">
            {fr.sujetsModule.codeVerificationSub}
          </p>
        </div>

        {verifyCodeError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span>{verifyCodeError}</span>
          </div>
        )}

        {isLocked && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-center gap-2">
            <Clock size={15} className="text-amber-700 shrink-0" />
            <span>{fr.sujetsModule.codeBloque} ({lockoutRemaining}s)</span>
          </div>
        )}

        <form onSubmit={handleVerifyCodeSubmit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.sujetsModule.codeVerificationLabel} *
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              disabled={isLocked}
              value={verifyCodeInput}
              onChange={(e) => {
                setVerifyCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                setVerifyCodeError(null);
              }}
              placeholder={fr.sujetsModule.codeVerificationPlaceholder}
              className={`w-full text-center tracking-widest text-lg font-mono p-2.5 rounded-lg border focus:outline-none transition ${
                isLocked
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 focus:ring-1 focus:ring-emerald-500'
              }`}
              required
            />
            <p className="text-[10px] text-slate-400 mt-1 text-center">
              Consulte la cloche des Notifications en haut pour lire ton SMS simulé
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLocked || verifyCodeInput.length !== 6}
              className={`w-full min-h-[46px] py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs ${
                !isLocked && verifyCodeInput.length === 6
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              <span>{fr.sujetsModule.btnValiderCode}</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={handleResendCode}
              className="w-full py-1.5 text-xs text-emerald-700 hover:underline text-center cursor-pointer disabled:text-slate-400 disabled:no-underline"
            >
              {fr.sujetsModule.btnRenvoyerCode}
            </button>

            <button
              type="button"
              onClick={() => setView('panier')}
              className="w-full py-1 text-xs text-slate-500 hover:text-slate-800 text-center cursor-pointer"
            >
              {fr.common.cancel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE PANIER (ILLIMITÉ)                                                     */
  /* ========================================================================= */
  if (view === 'panier') {
    const isUnverified = Boolean(candidat.compteCree && candidat.verificationStatut === 'non_verifie');
    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{fr.sujetsModule.panierTitle}</h2>
            <span className="text-[11px] text-slate-500">
              {fr.sujetsModule.panierCount.replace('{count}', String(cartItems.length))}
            </span>
          </div>

          {cartItems.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={isUnverified}
                onClick={handleStartCandidater}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  isUnverified
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                }`}
              >
                <span>{fr.sujetsModule.btnCandidater}</span>
                <ArrowRight size={14} />
              </button>
              {isUnverified && (
                <div className="flex items-center gap-1 text-[11px] text-amber-800 font-medium">
                  <span>{fr.sujetsModule.compteNonVerifieNotice}</span>
                  <button
                    type="button"
                    onClick={() => setView('verify_code')}
                    className="text-emerald-700 font-bold underline hover:text-emerald-800 cursor-pointer"
                  >
                    {fr.sujetsModule.btnSaisirMonCode}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <Heart size={28} className="text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600">{fr.sujetsModule.panierEmpty}</p>
            <button
              type="button"
              onClick={() => {
                setView('catalog');
                onNavigateTab?.('sujets');
              }}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {fr.sujetsModule.btnBackToCatalog}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cartItems.map((sujet) => {
              const ens = getEnseignant(sujet.enseignantId);
              const isApplied = candidat.candidatures.includes(sujet.id);

              const { Icon: DisciplineIcon, barColor, iconPill, badge: badgeColor, cardBg, cardBorder } = getDisciplineConfig(sujet.discipline);

              return (
                <div
                  key={sujet.id}
                  className={`group ${cardBg} border ${cardBorder} rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between overflow-hidden`}
                >
                  <div className={`h-1 w-full ${barColor}`} />
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconPill}`}
                          aria-hidden="true"
                        >
                          <DisciplineIcon size={13} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {sujet.discipline}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sujet.statut === 'archive' && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle size={12} className="text-amber-700 shrink-0" />
                            <span>{fr.sujetsModule.plusDisponible}</span>
                          </span>
                        )}
                        {isApplied && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <FileCheck2 size={12} className="text-emerald-600 shrink-0" />
                            <span>{fr.sujetsModule.alreadyAppliedBadge}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{sujet.titre}</h4>
                    <p className="text-[11px] text-slate-600">
                      <span className="font-medium text-slate-700">{sujet.structure}</span> {ens ? `• ${ens.nom}` : ''}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleCart(sujet.id)}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>{fr.sujetsModule.btnRemove}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2 space-y-1.5">
              <button
                type="button"
                disabled={isUnverified}
                onClick={handleStartCandidater}
                className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs ${
                  isUnverified
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                }`}
              >
                <span>{fr.sujetsModule.btnCandidater}</span>
                <ArrowRight size={16} />
              </button>
              {isUnverified && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-800 font-medium text-center">
                  <span>{fr.sujetsModule.candidaterDisabledUnverifiedReason}</span>
                  <button
                    type="button"
                    onClick={() => setView('verify_code')}
                    className="text-emerald-700 font-bold underline hover:text-emerald-800 cursor-pointer"
                  >
                    {fr.sujetsModule.btnSaisirMonCode}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 1 : CATALOGUE DES SUJETS (ACCUEIL CANDIDAT)                           */
  /* ========================================================================= */
  const isCandidateOrVisitor = role === 'candidat' || role === 'visiteur';

  // 1. DIRECTEUR : ONGLET "MES SUJETS"
  if (role === 'enseignant') {
    const teacherSubjects = sujets.filter((s) => s.enseignantId === activeTeacher.id);
    const activeTeacherSubjects = teacherSubjects.filter((s) => s.statut !== 'archive');
    const activeCount = activeTeacherSubjects.length;
    const restants = Math.max(0, QUOTA_SUJETS - activeCount);
    const quotaAtteint = activeCount >= QUOTA_SUJETS;

    return (
      <div className="space-y-4">
        {/* En-tête Mes sujets avec compteur de quota */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="text-emerald-700 shrink-0" size={22} />
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  {fr.mesSujets.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTeacher.nom} ({activeTeacher.structure}) — {fr.mesSujets.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Compteur "N/5 sujets, R restants" (sujets non archivés) */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  quotaAtteint
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {quotaAtteint ? (
                  <AlertCircle size={14} className="text-amber-700 shrink-0" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                )}
                <span>
                  {activeCount}/{QUOTA_SUJETS} sujets, {restants} restant{restants > 1 ? 's' : ''}
                </span>
              </div>

              {/* Bouton Ajouter un sujet */}
              {quotaAtteint ? (
                <div className="relative group">
                  <button
                    type="button"
                    disabled
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1.5 cursor-not-allowed select-none"
                  >
                    <Plus size={15} />
                    <span>{fr.mesSujets.btnAjouterSujet}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddError(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition"
                >
                  <Plus size={15} />
                  <span>{fr.mesSujets.btnAjouterSujet}</span>
                </button>
              )}
            </div>
          </div>

          {/* Indication quota atteint si 5/5 */}
          {quotaAtteint && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50/80 border border-amber-200 px-3 py-2 rounded-xl">
              <AlertCircle size={14} className="text-amber-700 shrink-0" />
              <span>{fr.mesSujets.quotaAtteint}</span>
            </div>
          )}

          {actionFeedback && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-3 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}
        </div>

        {/* Grille des sujets de l'enseignant */}
        {teacherSubjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <BookOpen size={28} className="text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600">{fr.mesSujets.aucunSujet}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teacherSubjects.map((sujet) => {
              const { Icon: DisciplineIcon, barColor, iconPill, badge: badgeColor, cardBg, cardBorder } = getDisciplineConfig(sujet.discipline);
              const candCount = getCandidaturesCount(sujet.id);
              const panierCount = getPaniersCount(sujet.id);
              const isArchived = sujet.statut === 'archive';

              return (
                <div
                  key={sujet.id}
                  className={`group ${cardBg} border ${cardBorder} rounded-2xl shadow-xs flex flex-col justify-between overflow-hidden`}
                >
                  <div className={`h-1.5 w-full ${barColor}`} />

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconPill}`}>
                            <DisciplineIcon size={13} />
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                            {sujet.discipline}
                          </span>
                        </div>

                        {/* Statut du sujet : Actif ou Archivé */}
                        {isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
                            <Archive size={12} className="text-slate-600 shrink-0" />
                            <span>{fr.mesSujets.statutArchive}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={12} className="text-emerald-700 shrink-0" />
                            <span>{fr.mesSujets.statutActif}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {sujet.titre}
                      </h3>

                      <p className="text-[11px] text-slate-600 font-medium">
                        {sujet.structure}
                      </p>

                      {sujet.descriptionCourte && (
                        <p className="text-xs text-slate-600 italic bg-white/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                          {sujet.descriptionCourte}
                        </p>
                      )}

                      {/* Indicateurs de candidatures et paniers */}
                      <div className="flex items-center gap-3 text-xs text-slate-600 font-medium pt-1">
                        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/70">
                          <FileText size={13} className="text-slate-500 shrink-0" />
                          <span>{candCount} candidature{candCount > 1 ? 's' : ''}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/70">
                          <Heart size={13} className="text-slate-500 shrink-0" />
                          <span>{panierCount} panier{panierCount > 1 ? 's' : ''}</span>
                        </span>
                      </div>
                    </div>

                    {/* Zone d'action et effet en une ligne */}
                    <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
                      {/* Cas 1 : Aucune candidature ni panier -> Supprimer */}
                      {candCount === 0 && panierCount === 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setSujetToDelete(sujet)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                          >
                            <Trash2 size={13} className="text-rose-600 shrink-0" />
                            <span>{fr.mesSujets.btnSupprimer}</span>
                          </button>
                          <p className="text-[11px] text-slate-500 italic mt-1 leading-tight">
                            {fr.mesSujets.effetSupprimer}
                          </p>
                        </div>
                      )}

                      {/* Cas 2 : Paniers seulement -> Retirer (statut archive, paniers affichent "Plus disponible") */}
                      {candCount === 0 && panierCount > 0 && (
                        <div>
                          {isArchived ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300">
                              <Archive size={13} className="text-slate-500 shrink-0" />
                              <span>{fr.mesSujets.statutArchive}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRetirerSujet(sujet)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                            >
                              <Archive size={13} className="text-amber-700 shrink-0" />
                              <span>{fr.mesSujets.btnRetirer}</span>
                            </button>
                          )}
                          <p className="text-[11px] text-slate-500 italic mt-1 leading-tight">
                            {fr.mesSujets.effetRetirer}
                          </p>
                        </div>
                      )}

                      {/* Cas 3 : Au moins une candidature -> Archiver (candidatures conservées) */}
                      {candCount > 0 && (
                        <div>
                          {isArchived ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300">
                              <Archive size={13} className="text-slate-500 shrink-0" />
                              <span>{fr.mesSujets.statutArchive}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArchiverSujet(sujet)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                            >
                              <Archive size={13} className="text-slate-700 shrink-0" />
                              <span>{fr.mesSujets.btnArchiver}</span>
                            </button>
                          )}
                          <p className="text-[11px] text-slate-500 italic mt-1 leading-tight">
                            {fr.mesSujets.effetArchiver}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal d'ajout de sujet */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Plus className="text-emerald-700 shrink-0" size={20} />
                  <h3 className="text-base font-bold text-slate-900">
                    {fr.mesSujets.modalAjoutTitre}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSujet} className="space-y-3.5">
                {addError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2 font-medium">
                    <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {fr.mesSujets.champTitre} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSujetTitre}
                    onChange={(e) => setNewSujetTitre(e.target.value)}
                    placeholder={fr.mesSujets.champTitrePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {fr.mesSujets.champDiscipline} <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={newSujetDiscipline}
                    onChange={(e) => setNewSujetDiscipline(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  >
                    <option value="">Sélectionnez une discipline...</option>
                    {DISCIPLINES_DISPONIBLES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {fr.mesSujets.champResume}
                  </label>
                  <textarea
                    rows={3}
                    value={newSujetResume}
                    onChange={(e) => setNewSujetResume(e.target.value)}
                    placeholder={fr.mesSujets.champResumePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {fr.mesSujets.btnAnnuler}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition cursor-pointer active:scale-98"
                  >
                    {fr.mesSujets.btnCreer}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de confirmation de suppression définitive */}
        {sujetToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {fr.mesSujets.btnSupprimer}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                    {sujetToDelete.titre}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                {fr.mesSujets.confirmSupprimer}
              </p>
              <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                {fr.mesSujets.effetSupprimer}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSujetToDelete(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {fr.mesSujets.btnAnnuler}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer active:scale-98"
                >
                  {fr.mesSujets.btnSupprimer}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isCandidateOrVisitor && (
        <div className="mt-6 mb-4 relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-xs text-center py-6 px-4 md:py-8">
          {/* Motif géométrique discret style zellige (étoile à 8 branches) */}
          <svg
            className="absolute inset-0 w-full h-full opacity-5 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern id="zellige-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
                <g stroke="currentColor" strokeWidth="1.2" fill="none" className="text-slate-900">
                  <rect x="14" y="14" width="20" height="20" />
                  <rect x="14" y="14" width="20" height="20" transform="rotate(45 24 24)" />
                  <circle cx="24" cy="24" r="3" />
                  <path d="M0 24h14 M34 24h14 M24 0v14 M24 34v14" />
                  <rect x="-6" y="-6" width="12" height="12" transform="rotate(45 0 0)" />
                  <rect x="42" y="-6" width="12" height="12" transform="rotate(45 48 0)" />
                  <rect x="-6" y="42" width="12" height="12" transform="rotate(45 0 48)" />
                  <rect x="42" y="42" width="12" height="12" transform="rotate(45 48 48)" />
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#zellige-pattern)" />
          </svg>

          <div className="relative z-10 flex flex-col items-center justify-center">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-800 leading-tight">
              <span>{fr.sujetsModule.bannerTitle}</span>{' '}
              <span className="text-amber-500 font-bold">{fr.sujetsModule.bannerYear}</span>
            </h1>
            <p className="mt-2 text-base md:text-xl text-emerald-700 font-medium">
              {fr.sujetsModule.bannerSubtitle}
            </p>
            <p className="mt-2.5 text-xs md:text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5 bg-emerald-50/90 px-3.5 py-1 rounded-full border border-emerald-200/70 shadow-2xs">
              <Calendar size={14} className="text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{fr.dossier.candidaturesDuAu.replace('{debut}', periode?.debut || '2026-07-01').replace('{fin}', periode?.fin || '2026-09-09')}</span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Barre de recherche globale instantanée avec icône filtre à droite */}
        <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder={fr.sujetsModule.searchPlaceholder}
          className="w-full pl-9 pr-20 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-xs"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Effacer recherche"
            >
              <X size={14} />
            </button>
          )}

          {/* Simple icône filtre sans texte avec badge du nombre de critères */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-label={fr.sujetsModule.btnFilterModal}
            className={`relative p-1.5 rounded-lg border transition ${
              activeCriteriaCount > 0
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal size={15} />
            {activeCriteriaCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shadow-xs">
                {activeCriteriaCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Puces de critères actifs retirables (✕) sous la barre */}
      {activeCriteriaCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {advancedCriteria.encadrant && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.encadrant}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, encadrant: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.discipline && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.discipline}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, discipline: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.structure && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.structure}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, structure: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full"
            >
              <span>#{kw}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({
                    ...advancedCriteria,
                    keywords: advancedCriteria.keywords.filter((k) => k !== kw),
                  })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 font-medium"
          >
            {fr.sujetsModule.btnReset}
          </button>
        </div>
      )}

      {/* Ligne compteur et tri */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5">
        <span className="font-semibold text-slate-700">
          {fr.sujetsModule.countSujets.replace('{count}', String(filteredSujets.length))}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">{fr.sujetsModule.sortLabel}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'titre' | 'structure')}
            className="bg-white border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
          >
            <option value="titre">{fr.sujetsModule.sortTitleAZ}</option>
            <option value="structure">{fr.sujetsModule.sortStructure}</option>
          </select>

          {(searchQuery || activeCriteriaCount > 0) && (
            <button
              onClick={handleResetFilters}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5 ml-1"
            >
              <RotateCcw size={11} />
              <span>{fr.sujetsModule.btnReset}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Popup de Recherche Avancée */}
      <AdvancedSearchModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        criteria={advancedCriteria}
        onApply={(crit) => {
          setAdvancedCriteria(crit);
          setCurrentPage(1);
        }}
        onReset={handleResetFilters}
        encadrantOptions={encadrantOptions}
        disciplineOptions={disciplineOptions}
        structureOptions={structureOptions}
        keywordOptions={keywordOptions}
      />

      {/* GRILLE RESPONSIVE : 1 COLONNE MOBILE, 2-3 COLONNES SUR GRAND ÉCRAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {paginatedSujets.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-xs text-slate-600">{fr.sujetsModule.emptyCatalog}</p>
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              {fr.sujetsModule.btnReset}
            </button>
          </div>
        ) : (
          paginatedSujets.map((sujet) => {
            const isExpanded = expandedId === sujet.id;
            const inCart = candidat.panier.includes(sujet.id);
            const isApplied = candidat.candidatures.includes(sujet.id);
            const ens = getEnseignant(sujet.enseignantId);
            const { Icon: DisciplineIcon, barColor, iconPill, badge: badgeColor, cardBg, cardBorder } = getDisciplineConfig(sujet.discipline);

            return (
              <div
                key={sujet.id}
                className={`group ${cardBg} border ${cardBorder} rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between overflow-hidden`}
              >
                {/* Bande colorée de 4 px en haut (couleur de la discipline) */}
                <div className={`h-1 w-full ${barColor}`} />

                {/* Corps de la carte compacte avec espacements réguliers */}
                <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sujet.id)}
                    className="cursor-pointer space-y-2"
                  >
                    {/* Badge de discipline avec pastille icône arrondie */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconPill}`}
                        aria-hidden="true"
                      >
                        <DisciplineIcon size={13} />
                      </div>
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border leading-tight line-clamp-1 ${badgeColor}`}>
                        {sujet.discipline}
                      </span>
                    </div>

                    {/* Titre en police plus grande que l'encadrant et la structure */}
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                      {sujet.titre}
                    </h3>

                    {/* Encadrant et structure */}
                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      <p className="truncate font-medium text-slate-700">{sujet.structure}</p>
                      {ens && <p className="truncate text-slate-500">{ens.nom}</p>}
                    </div>

                    {/* DÉTAIL DÉPLIABLE SUR PLACE (SANS POP-UP) */}
                    {isExpanded && (
                      <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                        {sujet.descriptionCourte && (
                          <p className="italic bg-slate-50 p-2 rounded-lg text-[11px] leading-relaxed text-slate-700">
                            {sujet.descriptionCourte}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {sujet.motsCles.map((k) => (
                            <span key={k} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                              #{k}
                            </span>
                          ))}
                        </div>
                        {ens && (
                          <div className="text-[11px] text-slate-600 pt-0.5">
                            <span className="font-semibold text-slate-800">{ens.nom}</span> • {ens.email}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bouton ♡ Ajouter au panier / Dans le panier / Candidature déposée */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span
                      onClick={() => setExpandedId(isExpanded ? null : sujet.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>

                    {isApplied ? (
                      <button
                        type="button"
                        disabled
                        className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center gap-1.5 cursor-not-allowed opacity-90 select-none"
                      >
                        <FileCheck2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{fr.sujetsModule.candidatureDeposeeBadge}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCart(sujet.id);
                        }}
                        className={`text-xs font-bold py-1 px-2.5 rounded-lg border transition flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                          inCart
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <Heart size={13} className={inCart ? 'fill-rose-600 text-rose-600' : 'text-slate-400'} />
                        <span>{inCart ? fr.sujetsModule.btnInCart : fr.sujetsModule.btnAddToCart}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION (6 PAR PAGE) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 text-xs">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft size={14} />
            <span>{fr.sujetsModule.btnPrevPage}</span>
          </button>

          <span className="text-slate-500 font-mono text-[11px]">
            {fr.sujetsModule.pageIndicator
              .replace('{page}', String(currentPage))
              .replace('{total}', String(totalPages))}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>{fr.sujetsModule.btnNextPage}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
