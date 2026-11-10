import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  Calendar,
  X,
} from 'lucide-react';
import { Creneau, Enseignant, Candidat, PV, SeanceStatutRecord } from '../types';
import { storageService } from '../services/storage';
import {
  MOCK_CANDIDATS,
  getConnectedDirecteurId,
  calculerStatutSeance,
  getSeancesStatutsMap,
  saveSeanceStatut,
  formatDateJJMM,
} from '../data/mockData';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';
import { ajouterNotification } from '../utils/messages';

// Constante unique du seuil d'inactivité (48 heures)
export const SEUIL_HEURES = 48;

export const Exceptions: React.FC = () => {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [seancesStatuts, setSeancesStatuts] = useState<Record<string, SeanceStatutRecord>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Constater que la séance n'a pas eu lieu
  const [constaterModal, setConstaterModal] = useState<{
    key: string;
    date: string;
    lieu: string;
    enseignantId: string;
    enseignantNom: string;
  } | null>(null);
  const [constaterMotif, setConstaterMotif] = useState('');
  const [constaterError, setConstaterError] = useState<string | null>(null);

  const connectedDirecteurId = getConnectedDirecteurId();

  const loadData = () => {
    try {
      setCreneaux(storageService.getCreneaux());
      setEnseignants(storageService.getEnseignants());
      setCandidat(storageService.getCandidat());
      const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
      if (rawPvs) {
        setPvs(JSON.parse(rawPvs));
      }
      setSeancesStatuts(getSeancesStatutsMap());
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_creneaux_updated', handleSync);
    window.addEventListener('usmba_account_updated', handleSync);
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('usmba_seances_updated', handleSync);
    window.addEventListener('usmba_demo_date_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_account_updated', handleSync);
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_seances_updated', handleSync);
      window.removeEventListener('usmba_demo_date_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const getEnseignantName = (id?: string): string => {
    if (!id) return fr.exceptions.nonRenseigne;
    const ens = enseignants.find((e) => e.id === id);
    if (ens && ens.nom && !ens.nom.startsWith('ens-')) return ens.nom;
    return fr.exceptions.nonRenseigne;
  };

  const getCandidatNom = (id?: string): string => {
    if (!id) return fr.exceptions.nonRenseigne;
    if (id === 'cand-salma') return 'Salma Alami';
    if (id === 'cand-khadija') return 'Khadija Tazi';
    if (id === 'cand-sara') return 'Sara Benjelloun';
    if (id === 'cand-omar') return 'Omar Idrissi';
    if (id === 'cand-001') return 'Yassine El Fassi';

    if (candidat && (id === candidat.id || id === 'cand-001')) {
      if (candidat.nom && !candidat.nom.startsWith('cand-')) return candidat.nom;
    }

    const found = MOCK_CANDIDATS.find((c) => c.id === id);
    if (found && found.nom && !found.nom.startsWith('cand-')) return found.nom;

    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      if (rawAccounts) {
        const accounts: Candidat[] = JSON.parse(rawAccounts);
        const match = accounts.find((a) => a.id === id);
        if (match && match.nom && !match.nom.startsWith('cand-')) return match.nom;
      }
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (cur.id === id && cur.nom && !cur.nom.startsWith('cand-')) return cur.nom;
      }
    } catch {}

    return fr.exceptions.nonRenseigne;
  };

  // 1. Filtrer les créneaux non confirmés (> 48h)
  const now = Date.now();
  const nonConfirmes = creneaux.filter((c) => {
    if (c.statut === 'reserve' && c.dateReservation) {
      const resTime = new Date(c.dateReservation).getTime();
      const diffHours = (now - resTime) / (1000 * 60 * 60);
      return diffHours > SEUIL_HEURES;
    }
    return false;
  });

  // Durée de silence en jours ("3 jours", "moins d'un jour")
  const getDureeSilence = (dateReservation?: string): string => {
    if (!dateReservation) return fr.exceptions.silenceDureeMoinsUnJour;
    const resTime = new Date(dateReservation).getTime();
    const diffHours = Math.max(0, (now - resTime) / (1000 * 60 * 60));
    const diffJours = Math.floor(diffHours / 24);
    if (diffJours < 1) {
      return fr.exceptions.silenceDureeMoinsUnJour;
    }
    if (diffJours === 1) {
      return fr.exceptions.silenceDureeUnJour;
    }
    return fr.exceptions.silenceDureeJours.replace('{count}', String(diffJours));
  };

  // Date JJ/MM à HH:mm
  const formatCreneauDate = (dateStr?: string, heureStr?: string): string => {
    if (!dateStr) return fr.exceptions.nonRenseigne;
    let jjmm = dateStr;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        jjmm = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
      }
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        jjmm = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
      }
    }
    return heureStr ? `${jjmm} à ${heureStr}` : jjmm;
  };

  // Date de relance au format JJ/MM
  const formatRelanceDate = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${fr.exceptions.relanceLePrefix} ${day}/${month}`;
    } catch {
      return isoString;
    }
  };

  // Bouton « Relancer »
  const handleRelancer = (creneauId: string) => {
    const cTarget = creneaux.find((c) => c.id === creneauId);
    if (!cTarget) return;

    if (connectedDirecteurId && cTarget.enseignantId === connectedDirecteurId) {
      setToastMessage(fr.exceptions.conflitDirecteur);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const updated = creneaux.map((c) => {
      if (c.id === creneauId) {
        return {
          ...c,
          relanceLe: new Date().toISOString(),
        };
      }
      return c;
    });

    try {
      storageService.setCreneaux(updated);
      setCreneaux(updated);

      // Notification 'action' envoyée au candidat
      if (cTarget.candidatId) {
        ajouterNotification({
          destinataireId: cTarget.candidatId,
          texte: fr.exceptions.notifRelanceCandidat,
          type: 'action',
        });
      }

      // Écriture d'un logEvent dans le journal
      const candNom = getCandidatNom(cTarget.candidatId);
      logEvent(
        { id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' },
        fr.journalActions.relanceEntretien,
        candNom,
        `Entretien du ${formatCreneauDate(cTarget.date, cTarget.heure)}`
      );

      setToastMessage(fr.exceptions.toastRelanceSuccess);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage(fr.exceptions.storageError);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Séances sans PV (pv_en_retard)
  const seanceKeys = new Set<string>();
  creneaux.forEach((c) => {
    if (c.enseignantId && c.date) {
      if (c.statut === 'confirme' || c.statut === 'reserve' || c.candidatId) {
        seanceKeys.add(`${c.enseignantId}_${c.date}`);
      }
    }
  });
  pvs.forEach((p) => {
    if (p.directeurId && p.date) {
      seanceKeys.add(`${p.directeurId}_${p.date}`);
    }
  });
  Object.keys(seancesStatuts).forEach((k) => {
    seanceKeys.add(k);
  });

  const seancesSansPv = Array.from(seanceKeys)
    .map((key) => {
      const [ensId, ...dateParts] = key.split('_');
      const date = dateParts.join('_');
      const sessionCreneaux = creneaux.filter((c) => c.enseignantId === ensId && c.date === date);
      const sessionPvs = pvs.filter((p) => p.directeurId === ensId && p.date === date);
      const statutRecord = seancesStatuts[key];
      const statutInfo = calculerStatutSeance(date, ensId, sessionPvs, statutRecord);
      const lieu = sessionCreneaux[0]?.lieu || 'CED';
      const ensNom = getEnseignantName(ensId);
      return {
        key,
        enseignantId: ensId,
        date,
        lieu,
        enseignantNom: ensNom,
        statut: statutInfo.statut,
        diffJours: statutInfo.diffJours,
        motif: statutInfo.motif,
        relanceLe: statutInfo.relanceLe || statutRecord?.relanceLe,
        creneaux: sessionCreneaux,
      };
    })
    .filter((s) => s.statut === 'pv_en_retard');

  const handleRelancerDirecteur = (seance: (typeof seancesSansPv)[0]) => {
    const nowIso = new Date().toISOString();
    saveSeanceStatut(seance.key, { relanceLe: nowIso });
    setSeancesStatuts((prev) => ({
      ...prev,
      [seance.key]: { ...(prev[seance.key] || {}), relanceLe: nowIso },
    }));

    // Notification 'action' envoyée au directeur
    ajouterNotification({
      destinataireId: seance.enseignantId,
      texte: fr.exceptions.notifRelancePvDirecteur.replace('{date}', formatDateJJMM(seance.date)),
      type: 'action',
    });

    // Journal
    logEvent(
      { id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' },
      fr.journalActions.relancePvDirecteur,
      seance.enseignantNom,
      `Séance du ${formatDateJJMM(seance.date)}`
    );

    setToastMessage(fr.exceptions.toastRelanceDirecteurSuccess);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenConstaterModal = (seance: (typeof seancesSansPv)[0]) => {
    setConstaterModal(seance);
    setConstaterMotif('');
    setConstaterError(null);
  };

  const handleConfirmConstater = () => {
    if (!constaterModal) return;
    const cleanMotif = constaterMotif.trim();
    if (cleanMotif.length < 5) {
      setConstaterError(fr.exceptions.modalConstaterMotifError);
      return;
    }

    const nowIso = new Date().toISOString();
    saveSeanceStatut(constaterModal.key, {
      statutManuel: 'non_tenue',
      motif: cleanMotif,
      declarePar: 'Structure CED',
      declareLe: nowIso,
    });

    // 1. Notifier tous les candidats de cette séance
    const touchedCandidates = new Set<string>();
    const sessionCreneaux = creneaux.filter(
      (c) => c.enseignantId === constaterModal.enseignantId && c.date === constaterModal.date
    );
    sessionCreneaux.forEach((c) => {
      if (c.candidatId && !touchedCandidates.has(c.candidatId)) {
        touchedCandidates.add(c.candidatId);
        ajouterNotification({
          destinataireId: c.candidatId,
          texte: fr.exceptions.notifSeanceNonTenue
            .replace('{date}', formatDateJJMM(constaterModal.date))
            .replace('{motif}', cleanMotif),
          type: 'action',
        });
      }
    });

    // 2. Rouvrir les créneaux
    const updatedCreneaux = creneaux.map((c) => {
      if (c.enseignantId === constaterModal.enseignantId && c.date === constaterModal.date) {
        return {
          ...c,
          statut: 'libre' as const,
          candidatId: undefined,
          dateReservation: undefined,
          dateConfirmation: undefined,
          relanceLe: undefined,
        };
      }
      return c;
    });

    try {
      storageService.setCreneaux(updatedCreneaux);
      setCreneaux(updatedCreneaux);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
    } catch {}

    // 3. Log event
    logEvent(
      { id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' },
      fr.journalActions.seanceNonTenue,
      `Séance du ${formatDateJJMM(constaterModal.date)} (${constaterModal.enseignantNom})`,
      cleanMotif
    );

    setToastMessage(fr.exceptions.toastConstatSuccess);
    setTimeout(() => setToastMessage(null), 3000);
    setConstaterModal(null);
    setConstaterMotif('');
    setConstaterError(null);
  };

  return (
    <div className="max-w-[768px] mx-auto space-y-8 pb-12">
      {/* Toast de notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* En-tête : Titre et Sous-titre */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h1 className="text-base sm:text-lg font-bold text-slate-900">
          {fr.exceptions.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {fr.exceptions.subtitle}
        </p>
      </div>

      {/* Section 1 : Séances sans PV */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {fr.exceptions.seancesSansPvTitle}
            </h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            {seancesSansPv.length}
          </span>
        </div>

        {seancesSansPv.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-xs flex flex-col items-center justify-center gap-2">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <span className="font-medium">{fr.exceptions.emptySeancesSansPv}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {seancesSansPv.map((s) => {
              const seanceTitre = fr.exceptions.seanceDuLieu
                .replace('{date}', formatDateJJMM(s.date))
                .replace('{lieu}', s.lieu);
              const retardTexte =
                s.diffJours <= 1
                  ? fr.exceptions.pvAttenduDepuisUnJour
                  : fr.exceptions.pvAttenduDepuisJours.replace('{count}', String(s.diffJours));
              const isRelance = Boolean(s.relanceLe);

              return (
                <div
                  key={s.key}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  {/* Ligne supérieure : Titre séance & Retard */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{seanceTitre}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{s.enseignantNom}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      <Clock size={12} className="text-amber-600" />
                      <span>{retardTexte}</span>
                    </span>
                  </div>

                  {/* Pastille texte + icône */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
                      <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                      <span>{fr.exceptions.badgePvEnRetard}</span>
                    </span>
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    <div>
                      {isRelance ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        >
                          <Clock size={12} />
                          <span>
                            {fr.exceptions.relanceDirecteurLe} {formatDateJJMM(s.relanceLe?.split('T')[0])}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRelancerDirecteur(s)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 shadow-xs cursor-pointer active:scale-98 transition"
                        >
                          <Send size={12} />
                          <span>{fr.exceptions.btnRelancerDirecteur}</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenConstaterModal(s)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-98 transition"
                    >
                      <AlertCircle size={13} className="shrink-0" />
                      <span>{fr.exceptions.btnConstaterNonTenue}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section : Entretiens non confirmés (> 48 h) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {fr.exceptions.sectionNonConfirmesTitle}
            </h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            {nonConfirmes.length}
          </span>
        </div>

        {nonConfirmes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-xs flex flex-col items-center justify-center gap-2">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <span className="font-medium">{fr.exceptions.emptyNonConfirmes}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {nonConfirmes.map((c) => {
              const candNom = getCandidatNom(c.candidatId);
              const ensNom = getEnseignantName(c.enseignantId);
              const dureeSilence = getDureeSilence(c.dateReservation);
              const isRelance = Boolean(c.relanceLe);
              const isDirecteurOfCreneau = Boolean(
                connectedDirecteurId && c.enseignantId && connectedDirecteurId === c.enseignantId
              );

              return (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  {/* Ligne supérieure : Candidat, Directeur & Durée de silence */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{candNom}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{ensNom}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                      <Clock size={12} className="text-rose-500" />
                      <span>{dureeSilence}</span>
                    </span>
                  </div>

                  {/* Ligne médiane : Date JJ/MM à HH:mm */}
                  <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <span className="font-semibold">{formatCreneauDate(c.date, c.heure)}</span>
                  </div>

                  {/* Ligne d'action : Pastille de silence & Bouton Relancer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 w-fit">
                      <Clock size={13} className="text-rose-600" />
                      <span>{fr.exceptions.silenceBadge}</span>
                    </span>

                    {isRelance ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      >
                        <Clock size={12} />
                        <span>{formatRelanceDate(c.relanceLe)}</span>
                      </button>
                    ) : (
                      <div className="flex flex-col sm:items-end gap-1">
                        <button
                          type="button"
                          disabled={isDirecteurOfCreneau}
                          onClick={() => !isDirecteurOfCreneau && handleRelancer(c.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs ${
                            isDirecteurOfCreneau
                              ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                              : 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer active:scale-98 transition'
                          }`}
                        >
                          <Send size={12} />
                          <span>{fr.exceptions.btnRelancer}</span>
                        </button>
                        {isDirecteurOfCreneau && (
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 sm:justify-end">
                            <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                            <span>{fr.exceptions.conflitDirecteur}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Raison écrite */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircle size={13} className="text-slate-400 shrink-0" />
                      <span>{fr.exceptions.raisonNonConfirme}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Constater que la séance n'a pas eu lieu */}
      {constaterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{fr.exceptions.modalConstaterTitre}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {fr.exceptions.seanceDuLieu
                    .replace('{date}', formatDateJJMM(constaterModal.date))
                    .replace('{lieu}', constaterModal.lieu)}{' '}
                  • {constaterModal.enseignantNom}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConstaterModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {fr.exceptions.modalConstaterDesc}
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {fr.exceptions.modalConstaterMotifLabel}
              </label>
              <textarea
                rows={3}
                value={constaterMotif}
                onChange={(e) => {
                  setConstaterMotif(e.target.value);
                  setConstaterError(null);
                }}
                placeholder={fr.exceptions.modalConstaterMotifPlaceholder}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              {constaterError && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{constaterError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConstaterModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {fr.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmConstater}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs transition cursor-pointer"
              >
                {fr.exceptions.btnConfirmerConstat}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
