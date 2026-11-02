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
} from 'lucide-react';
import { UserRole, Candidat, Enseignant, Sujet, Piece, Creneau, Notification, type Dossier as DossierData } from './types';
import { storageService } from './services/storage';
import { fr } from './i18n/fr';
import { LoginModal } from './components/LoginModal';
import { TabType } from './components/MobileNav';
import { Notifications } from './components/Notifications';
import { StatusBadge } from './components/StatusBadge';
import { SujetsModule } from './components/SujetsModule';
import { Dossier } from './components/Dossier';
import { Entretiens } from './components/Entretiens';
import { MesCreneaux } from './components/MesCreneaux';
import { Exceptions } from './components/Exceptions';
import { Commission } from './components/Commission';

export type AppTabType = TabType | 'commission';

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

export default function App() {
  const estMobile = useEstMobile();
  const [role, setRole] = useState<UserRole>('candidat');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<AppTabType>('sujets');
  const [candidat, setCandidat] = useState<Candidat>(storageService.getCandidat());
  const [sujets, setSujets] = useState<Sujet[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [dossier, setDossier] = useState<DossierData>(storageService.getDossier());
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [simulatedStatuts, setSimulatedStatuts] = useState<Record<string, 'deposee' | 'retenue'>>({});
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialisation au montage : démarre en visiteur sans compte
  useEffect(() => {
    storageService.initializeIfNeeded();
    refreshState();
    setTab('sujets');

    const handleSync = () => {
      refreshState();
    };
    window.addEventListener('usmba_pieces_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pieces_updated', handleSync);
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
  };

  const handleLoginSuccess = (userRole: UserRole, _email?: string, candidateData?: Candidat) => {
    setIsLoggedIn(true);
    setRole(userRole);
    setRestrictionMsg(undefined);

    if (userRole === 'candidat') {
      if (candidateData) {
        setCandidat(candidateData);
        storageService.setCandidat(candidateData);
      } else {
        const demo = storageService.loginAsDemo();
        setCandidat(demo);
      }
      setTab('sujets');
    } else if (userRole === 'enseignant') {
      setTab('sujets');
    } else {
      setTab('ced');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole('candidat');
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

    // Pages ouvertes aux visiteurs
    if (targetTab === 'sujets' || targetTab === 'panier') {
      setTab(targetTab);
      return;
    }

    // Protection des pages nécessitant un rôle
    if (!isLoggedIn) {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'dossier' && role !== 'candidat') {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'candidatures_recues' && role !== 'enseignant') {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'commission' && role !== 'enseignant') {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    if (targetTab === 'ced' && role !== 'directeur_ced') {
      setRestrictionMsg(fr.auth.accessRestricted);
      setIsLoginOpen(true);
      return;
    }

    setTab(targetTab);
  };

  const handleResetData = () => {
    storageService.resetToDefaults();
    refreshState();
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

  // Alertes CED (> 48h en attente de confirmation)
  const now = new Date('2026-10-28T04:24:00Z').getTime();
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
      statut: 'deposee' | 'retenue';
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
            list.push({
              key: `${candidat.id}-${id}`,
              candidatId: candidat.id,
              sujetId: s.id,
              candidatNom: candidat.nom || 'Candidat USMBA',
              cne: candidat.cne || 'CNE',
              sujetTitre: s.titre,
              date: '28/10/2026',
              statut: candidat.candidaturesStatuts?.[id] || 'deposee',
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

  const handleToggleRetenir = (item: {
    key: string;
    sujetId: string;
    statut: 'deposee' | 'retenue';
    isCurrentCandidat: boolean;
    candidatId?: string;
  }) => {
    const newStatut: 'deposee' | 'retenue' = item.statut === 'deposee' ? 'retenue' : 'deposee';

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

  const currentUserName = isLoggedIn
    ? role === 'candidat'
      ? candidat.nom || 'Candidat'
      : role === 'enseignant'
      ? activeEnseignant.nom
      : fr.app.cedName
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
              <nav className="hidden md:flex items-center gap-1">
                {/* Onglets Candidat */}
                {isLoggedIn && role === 'candidat' && (
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

                {/* Onglets Enseignant */}
                {isLoggedIn && role === 'enseignant' && (
                  <>
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
                    <button
                      onClick={() => handleTabChange('candidatures_recues')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                        tab === 'candidatures_recues'
                          ? 'bg-emerald-800 text-amber-300'
                          : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                      }`}
                    >
                      <span>{fr.nav.candidatures}</span>
                      {candidaturesEnseignant.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                          {candidaturesEnseignant.length}
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
                      <span>{fr.nav.mesCreneaux}</span>
                    </button>
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
                  </>
                )}

                {/* Onglets CED */}
                {isLoggedIn && role === 'directeur_ced' && (
                  <>
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

                {/* Se connecter ou Mon compte */}
                {!isLoggedIn ? (
                  <button
                    onClick={() => setIsLoginOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-emerald-100 hover:text-white hover:bg-emerald-900/60 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn size={14} />
                    <span>{fr.auth.login}</span>
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                        accountMenuOpen
                          ? 'bg-emerald-800 text-amber-300'
                          : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
                      }`}
                    >
                      <User size={14} className="text-emerald-300" />
                      <span className="max-w-[120px] truncate">{currentUserName || fr.auth.accountMenu}</span>
                      <ChevronDown size={13} className="text-emerald-400" />
                    </button>

                    {accountMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <div className="px-3 py-2 border-b border-slate-100">
                          <p className="font-bold text-slate-900 truncate">{currentUserName || fr.auth.accountMenu}</p>
                          <span className="text-[10px] font-semibold uppercase text-emerald-700">
                            {role === 'candidat'
                              ? fr.auth.roleCandidatBadge
                              : role === 'enseignant'
                              ? fr.auth.roleEnseignantBadge
                              : fr.auth.roleCedBadge}
                          </span>
                        </div>

                        <button
                          onClick={handleResetData}
                          className="w-full text-left px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>{fr.nav.resetData}</span>
                        </button>

                        <button
                          onClick={handleLogout}
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

              {/* Icône panier avec badge */}
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
              initialView="panier"
              onNavigateTab={handleTabChange}
            />
          )}

          {/* Onglet Enseignant : Candidatures reçues */}
          {tab === 'candidatures_recues' && (
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
                <div className="space-y-2.5">
                  {candidaturesEnseignant.map((item) => (
                    <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.candidatNom}</span>
                        {item.statut === 'deposee' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 italic">
                              {fr.dossier.simulationMention}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRetenir(item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer active:scale-98"
                            >
                              {fr.dossier.btnRetenir}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={12} className="text-emerald-700 shrink-0" />
                              <span>{fr.dossier.badgeRetenu}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRetenir(item)}
                              className="text-[11px] text-slate-500 hover:text-rose-600 underline underline-offset-2 transition-colors cursor-pointer"
                            >
                              {fr.dossier.btnAnnuler}
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 font-medium">{item.sujetTitre}</p>

                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          <FileText size={11} className="text-slate-500" />
                          <span>{item.piecesDeclarees}/4 {fr.dossier.piecesDeclarees}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          <span>{item.piecesProuvees}/4 {fr.dossier.piecesProuvees}</span>
                        </span>

                        {item.motifCasParticulier && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                            <span>Cas : {item.motifCasParticulier}</span>
                          </span>
                        )}

                        {item.guichet && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <AlertCircle size={11} className="text-amber-600" />
                            <span>{fr.dossier.guichetBadge}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100">
                        <span>{item.cne}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Onglet « Mon dossier » (candidat) */}
          {tab === 'dossier' && role === 'candidat' && isLoggedIn && (
            <Dossier />
          )}

          {/* Onglet Entretiens (Candidat) */}
          {tab === 'entretiens' && role === 'candidat' && (
            <Entretiens />
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

          {/* Onglet Entretiens (Directeur CED) */}
          {tab === 'entretiens' && role === 'directeur_ced' && (
            <Exceptions />
          )}

          {/* Onglet Exceptions CED (Directeur CED) */}
          {tab === 'ced' && (
            <Exceptions />
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

        {/* Barre de navigation mobile inférieure tactile (masquée sur md: et plus) avec repère Preuves à fournir */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg safe-bottom">
          <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto grid grid-flow-col auto-cols-fr px-2 py-1.5">
            {/* Onglet Sujets */}
            <button
              onClick={() => handleTabChange('sujets')}
              type="button"
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                tab === 'sujets' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Search size={18} />
              </div>
              <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                {estMobile ? fr.nav.court.sujets : (role === 'enseignant' ? fr.nav.mesSujets : fr.nav.sujets)}
              </span>
              {tab === 'sujets' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
            </button>

            {/* Onglet Mon dossier (candidat connecté) avec pastille numérique */}
            {isLoggedIn && role === 'candidat' && (
              <button
                onClick={() => handleTabChange('dossier')}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  tab === 'dossier' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <FolderKanban size={18} />
                  {isRetenuWithUnproven && (
                    <span
                      className="absolute -top-1.5 -right-3 text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white bg-amber-500 shadow-xs flex items-center gap-0.5"
                      title={`${piecesAProverCount} ${fr.dossier.preuvesAFournirCount}`}
                    >
                      <AlertCircle size={9} className="shrink-0" />
                      <span>{piecesAProverCount}</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile ? fr.nav.court.dossier : fr.nav.dossier}
                </span>
                {tab === 'dossier' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
              </button>
            )}

            {/* Onglet Candidatures reçues (enseignant connecté) */}
            {isLoggedIn && role === 'enseignant' && (
              <button
                onClick={() => handleTabChange('candidatures_recues')}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  tab === 'candidatures_recues' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <FileText size={18} />
                  {candidaturesEnseignant.length > 0 && (
                    <span className="absolute -top-1.5 -right-3 text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white bg-emerald-600 shadow-xs">
                      {candidaturesEnseignant.length}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile ? fr.nav.court.candidatures : fr.nav.candidatures}
                </span>
                {tab === 'candidatures_recues' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
              </button>
            )}

            {/* Onglet Commission (enseignant connecté) */}
            {isLoggedIn && role === 'enseignant' && (
              <button
                onClick={() => handleTabChange('commission')}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  tab === 'commission' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Award size={18} />
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile ? fr.nav.court.commission : fr.commission.tabTitle}
                </span>
                {tab === 'commission' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
              </button>
            )}

            {/* Onglet Exceptions CED (CED connecté) */}
            {isLoggedIn && role === 'directeur_ced' && (
              <button
                onClick={() => handleTabChange('ced')}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  tab === 'ced' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <ShieldAlert size={18} />
                  {alertesCreneaux.length > 0 && (
                    <span className="absolute -top-1.5 -right-3 text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white bg-rose-500 shadow-xs">
                      {alertesCreneaux.length}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile ? fr.nav.court.exceptionsCed : fr.nav.exceptionsCed}
                </span>
                {tab === 'ced' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
              </button>
            )}

            {/* Onglet Entretiens (connecté) */}
            {isLoggedIn && (
              <button
                onClick={() => handleTabChange('entretiens')}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  tab === 'entretiens' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <CalendarCheck2 size={18} />
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile
                    ? (role === 'enseignant' ? fr.nav.court.creneaux : fr.nav.court.entretiens)
                    : (role === 'enseignant' ? fr.nav.mesCreneaux : fr.nav.entretiens)}
                </span>
                {tab === 'entretiens' && <span className="w-5 h-1 bg-emerald-600 rounded-full mt-0.5 animate-pulse" />}
              </button>
            )}

            {/* Non connecté : Se connecter */}
            {!isLoggedIn && (
              <button
                onClick={() => setIsLoginOpen(true)}
                type="button"
                className="relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer text-slate-500 hover:text-slate-800"
              >
                <div className="relative">
                  <LogIn size={18} />
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {fr.auth.login}
                </span>
              </button>
            )}

            {/* Connecté : Mon compte */}
            {isLoggedIn && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                type="button"
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all min-h-[50px] active:scale-90 cursor-pointer ${
                  mobileMenuOpen ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <User size={18} />
                </div>
                <span className="text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {estMobile ? fr.nav.court.compte : fr.auth.accountMenu}
                </span>
              </button>
            )}
          </div>
        </nav>

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
                    <p className="font-bold text-xs text-slate-900">{currentUserName || fr.auth.accountMenu}</p>
                    <span className="text-[10px] font-bold uppercase text-emerald-700">
                      {role === 'candidat'
                        ? fr.auth.roleCandidatBadge
                        : role === 'enseignant'
                        ? fr.auth.roleEnseignantBadge
                        : fr.auth.roleCedBadge}
                    </span>
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
        />
      </div>
    </div>
  );
}
