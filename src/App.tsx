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
} from 'lucide-react';
import { UserRole, Candidat, Enseignant, Sujet, Piece, Creneau, Dossier } from './types';
import { storageService } from './services/storage';
import { fr } from './i18n/fr';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { MobileNav, TabType } from './components/MobileNav';
import { StatusBadge } from './components/StatusBadge';
import { SujetsModule } from './components/SujetsModule';
import { DossierModule } from './components/DossierModule';

export default function App() {
  const [role, setRole] = useState<UserRole>('candidat');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<TabType>('sujets');
  const [candidat, setCandidat] = useState<Candidat>(storageService.getCandidat());
  const [sujets, setSujets] = useState<Sujet[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [showToast, setShowToast] = useState(false);

  // Initialisation au montage : démarre en visiteur sans compte
  useEffect(() => {
    storageService.initializeIfNeeded();
    refreshState();
    setTab('sujets');
  }, []);

  const refreshState = () => {
    setCandidat(storageService.getCandidat());
    setSujets(storageService.getSujets());
    setEnseignants(storageService.getEnseignants());
    setPieces(storageService.getPieces());
    setCreneaux(storageService.getCreneaux());
  };

  const handleLoginSuccess = (userRole: UserRole) => {
    setIsLoggedIn(true);
    setRole(userRole);
    setRestrictionMsg(undefined);

    if (userRole === 'candidat') {
      const demo = storageService.loginAsDemo();
      setCandidat(demo);
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

  const handleTabChange = (targetTab: TabType) => {
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

  // Candidatures reçues pour l'enseignant actif (lecture seule)
  const teacherSubjectIds = sujetsEnseignant.map((s) => s.id);
  const candidaturesEnseignant = useMemo(() => {
    const list: {
      candidatNom: string;
      cne: string;
      sujetTitre: string;
      date: string;
    }[] = [];

    // Candidatures de l'étudiant actif
    if (candidat.compteCree && candidat.candidatures) {
      candidat.candidatures.forEach((id) => {
        if (teacherSubjectIds.includes(id)) {
          const s = sujets.find((x) => x.id === id);
          if (s) {
            list.push({
              candidatNom: candidat.nom || 'Candidat USMBA',
              cne: candidat.cne || 'CNE',
              sujetTitre: s.titre,
              date: '28/10/2026',
            });
          }
        }
      });
    }

    // Candidatures d'autres étudiants simulés pour la démo
    if (activeEnseignant.id === 'ens-1') {
      list.push(
        {
          candidatNom: 'Salma Alami',
          cne: 'N149021873',
          sujetTitre: 'Cybersécurité des Véhicules Connectés et Protocoles V2X',
          date: '25/10/2026',
        },
        {
          candidatNom: 'Khadija Tazi',
          cne: 'M142078911',
          sujetTitre: 'Optimisation des Réseaux Électriques Intelligents (Smart Grids)',
          date: '26/10/2026',
        }
      );
    }

    return list;
  }, [candidat, teacherSubjectIds, sujets, activeEnseignant]);

  const piecesPretesCount = pieces.filter(
    (p) => p.statut === 'prouvee' || p.statut === 'declaree'
  ).length;

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
        {/* En-tête épuré */}
        <Header
          role={role}
          isLoggedIn={isLoggedIn}
          userName={currentUserName}
          currentTab={tab}
          onTabChange={handleTabChange}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          onReset={handleResetData}
          panierCount={candidat.panier?.length || 0}
        />

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

          {/* Onglet Enseignant : Candidatures reçues (Lecture seule) */}
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
                <div className="space-y-2">
                  {candidaturesEnseignant.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.candidatNom}</span>
                        <StatusBadge type="candidature" size="sm" />
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{item.sujetTitre}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>{item.cne}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Onglet Aperçu Dossier (Préparation Module A3) */}
          {tab === 'dossier' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 text-blue-800 flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <div>
                  <span className="inline-block text-[11px] font-bold text-blue-800 uppercase tracking-wider bg-blue-200/70 px-2 py-0.5 rounded-full mb-1">
                    {fr.moduleA3Preview.status}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    {fr.moduleA3Preview.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {fr.moduleA3Preview.sub}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('sujets')}
                    className="w-full min-h-[46px] rounded-xl font-semibold text-xs bg-blue-700 text-white flex items-center justify-center gap-2"
                  >
                    <span>{fr.sujetsModule.btnBackToCatalog}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Onglet Aperçu Entretiens (Préparation Module A5) */}
          {tab === 'entretiens' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-900 flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <div>
                  <span className="inline-block text-[11px] font-bold text-amber-900 uppercase tracking-wider bg-amber-200/70 px-2 py-0.5 rounded-full mb-1">
                    {fr.moduleA5Preview.status}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    {fr.moduleA5Preview.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {fr.moduleA5Preview.sub}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('sujets')}
                    className="w-full min-h-[46px] rounded-xl font-semibold text-xs bg-amber-700 text-white flex items-center justify-center gap-2"
                  >
                    <span>{fr.sujetsModule.btnBackToCatalog}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Onglet Aperçu CED (Préparation Module 5) */}
          {tab === 'ced' && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-900 flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <span className="inline-block text-[11px] font-bold text-rose-900 uppercase tracking-wider bg-rose-200/70 px-2 py-0.5 rounded-full mb-1">
                    {fr.moduleCedPreview.status}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">
                    {fr.moduleCedPreview.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {fr.moduleCedPreview.sub}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('sujets')}
                    className="w-full min-h-[46px] rounded-xl font-semibold text-xs bg-rose-700 text-white flex items-center justify-center gap-2"
                  >
                    <span>{fr.sujetsModule.btnBackToCatalog}</span>
                  </button>
                </div>
              </div>
            </div>
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

        {/* Barre de navigation mobile inférieure tactile (masquée sur md: et plus) */}
        <MobileNav
          currentTab={tab}
          onTabChange={handleTabChange}
          role={role}
          isLoggedIn={isLoggedIn}
          userName={currentUserName}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          onReset={handleResetData}
          badgeCounts={{
            panierCount: candidat.panier?.length || 0,
            candidaturesCount: candidaturesEnseignant.length,
            piecesPretes: piecesPretesCount,
            alertesCed: alertesCreneaux.length,
          }}
        />

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
