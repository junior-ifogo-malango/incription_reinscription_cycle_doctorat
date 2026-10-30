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
import { UserRole, Candidat, Enseignant, Sujet, Piece, Creneau, type Dossier as DossierData } from './types';
import { storageService } from './services/storage';
import { fr } from './i18n/fr';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { MobileNav, TabType } from './components/MobileNav';
import { StatusBadge } from './components/StatusBadge';
import { SujetsModule } from './components/SujetsModule';
import { Dossier } from './components/Dossier';
import { Entretiens } from './components/Entretiens';
import { MesCreneaux } from './components/MesCreneaux';
import { Exceptions } from './components/Exceptions';

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
  const [dossier, setDossier] = useState<DossierData>(storageService.getDossier());
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [simulatedStatuts, setSimulatedStatuts] = useState<Record<string, 'deposee' | 'retenue'>>({});

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
    setDossier(storageService.getDossier());
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
      piecesPretes: number;
      motifCasParticulier?: string;
      guichet?: boolean;
      isCurrentCandidat: boolean;
    }[] = [];

    // Candidatures de l'étudiant actif
    if (candidat.compteCree && candidat.candidatures) {
      const activePiecesPretes = (candidat.pieces || []).filter(
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
              piecesPretes: activePiecesPretes,
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
          piecesPretes: 3,
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
          piecesPretes: 4,
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
  }) => {
    const newStatut: 'deposee' | 'retenue' = item.statut === 'deposee' ? 'retenue' : 'deposee';
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <FileText size={11} className="text-slate-500" />
                          <span>{item.piecesPretes}/4 {fr.dossier.piecesPretes}</span>
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
