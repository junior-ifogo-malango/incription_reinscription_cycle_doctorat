import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { Rapport } from '../types';
import {
  INITIAL_RAPPORTS,
  getConnectedDirecteurId,
  formatDateJJMM,
  INITIAL_ENSEIGNANTS,
  DEMO_DOCTORANT_NADIA,
  MOCK_CANDIDATS,
  getComptes,
} from '../data/mockData';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';
import { ajouterNotification } from '../utils/messages';

const STORAGE_KEY_RAPPORTS = 'usmba_doctorat_rapports';

export const CedReinscriptions: React.FC = () => {
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rectifMotifs, setRectifMotifs] = useState<Record<string, string>>({});

  const loadData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RAPPORTS);
      if (raw) {
        setRapports(JSON.parse(raw));
      } else {
        localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(INITIAL_RAPPORTS));
        setRapports(INITIAL_RAPPORTS);
      }
    } catch {
      setRapports(INITIAL_RAPPORTS);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_rapports_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_rapports_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const saveList = (updated: Rapport[], msg?: string) => {
    try {
      localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(updated));
      setRapports(updated);
      if (msg) {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3500);
      }
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
    } catch {
      setErrorMsg('Erreur lors de la sauvegarde.');
    }
  };

  // Validation définitive par le CED
  const handleValider = (reportId: string) => {
    const target = rapports.find((r) => r.id === reportId);
    if (!target || !target.comite) return;

    const favorableCount = target.comite.filter((v) => v.avis === 'FAVORABLE').length;
    if (favorableCount !== 3) {
      setErrorMsg(
        fr.reinscription.allFavorableRequiredReason.replace('{count}', String(favorableCount))
      );
      return;
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const updated = rapports.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          statut: 'valide_ced' as const,
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Directeur de structure / Établissement',
              action: 'Validation définitive de la réinscription doctorale',
            },
          ],
        };
      }
      return r;
    });

    saveList(updated, fr.reinscription.cedValidatedToast);
  };

  // Renvoi pour rectification
  const handleRectifier = (reportId: string) => {
    const motif = (rectifMotifs[reportId] || '').trim();
    if (!motif) {
      setErrorMsg(fr.reinscription.rectificationMotifRequired);
      return;
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const updated = rapports.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          statut: 'a_corriger' as const,
          commentaires: [
            ...(r.commentaires || []),
            {
              auteur: 'Directeur de structure',
              date: todayStr,
              texte: `Rectification demandée : ${motif}`,
            },
          ],
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Directeur de structure',
              action: `Dossier renvoyé pour rectification : ${motif}`,
            },
          ],
        };
      }
      return r;
    });

    setRectifMotifs({ ...rectifMotifs, [reportId]: '' });
    saveList(updated, fr.reinscription.cedRectificationToast);
  };

  const SEUIL_HEURES = 48;
  const now = Date.now();
  const connectedDirecteurId = getConnectedDirecteurId();

  // Détection des rapports en retard (> 48h sans action)
  const isRapportEnRetard = (r: Rapport): boolean => {
    if (r.statut !== 'soumis' && r.statut !== 'avis_comite') return false;
    if (!r.soumisLe) return false;
    const resTime = new Date(r.soumisLe).getTime();
    const diffHours = (now - resTime) / (1000 * 60 * 60);
    return diffHours > SEUIL_HEURES;
  };

  const getDoctorantNom = (docId?: string): string => {
    if (!docId) return fr.reinscription.nonRenseigne;
    if (docId === 'doc-nadia') return DEMO_DOCTORANT_NADIA.nom;
    if (docId === 'doc-tariq') return 'Tariq Mansouri';
    try {
      const rawCand = localStorage.getItem('usmba_candidats');
      if (rawCand) {
        const cands: { id: string; nom: string }[] = JSON.parse(rawCand);
        const found = cands.find((c) => c.id === docId);
        if (found?.nom?.trim() && !found.nom.startsWith('cand-') && !found.nom.startsWith('doc-')) {
          return found.nom;
        }
      }
    } catch {}
    const cand = MOCK_CANDIDATS.find((c) => c.id === docId);
    if (cand?.nom?.trim() && !cand.nom.startsWith('cand-') && !cand.nom.startsWith('doc-')) {
      return cand.nom;
    }
    const compte = getComptes().find((c) => c.id === docId);
    if (compte?.nom?.trim() && !compte.nom.startsWith('cand-') && !compte.nom.startsWith('doc-')) {
      return compte.nom;
    }
    return fr.reinscription.nonRenseigne;
  };

  const getEncadrantNom = (ensId?: string): string => {
    if (!ensId) return fr.reinscription.nonRenseigne;
    try {
      const rawEns = localStorage.getItem('usmba_enseignants');
      if (rawEns) {
        const ensList: { id: string; nom: string }[] = JSON.parse(rawEns);
        const found = ensList.find((e) => e.id === ensId);
        if (found?.nom?.trim() && !found.nom.startsWith('ens-')) return found.nom;
      }
    } catch {}
    const ens = INITIAL_ENSEIGNANTS.find((e) => e.id === ensId);
    if (ens?.nom?.trim() && !ens.nom.startsWith('ens-')) return ens.nom;
    const compte = getComptes().find((c) => c.id === ensId);
    if (compte?.nom?.trim() && !compte.nom.startsWith('ens-')) return compte.nom;
    return fr.reinscription.nonRenseigne;
  };

  const handleRelancerMembreComite = (reportId: string, memberIdx: number) => {
    const target = rapports.find((r) => r.id === reportId);
    if (!target || !target.comite || !target.comite[memberIdx]) return;
    const member = target.comite[memberIdx];

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const nowIso = new Date().toISOString();
    const docNom = getDoctorantNom(target.doctorantId);

    ajouterNotification({
      destinataireId: member.code || member.membre,
      texte: fr.reinscription.notifRelanceComite.replace('{doctorant}', docNom),
      type: 'action',
      actionLabel: 'Voter',
      actionTab: 'vote_comite',
    });

    logEvent(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      fr.journalActions.relanceMembreComite,
      member.membre,
      `Rapport de ${docNom} (${target.titre})`
    );

    const updated = rapports.map((r) => {
      if (r.id === reportId && r.comite) {
        const updatedComite = r.comite.map((v, i) => {
          if (i === memberIdx) {
            return { ...v, relanceLe: nowIso };
          }
          return v;
        });
        return {
          ...r,
          comite: updatedComite,
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Directeur de structure',
              action: `Relance envoyée à ${member.membre} pour avis comité`,
            },
          ],
        };
      }
      return r;
    });

    saveList(updated, fr.reinscription.relanceMembreToast);
  };

  const handleRelancerEncadrant = (reportId: string) => {
    const target = rapports.find((r) => r.id === reportId);
    if (!target) return;

    if (connectedDirecteurId && target.encadrantId === connectedDirecteurId) {
      setErrorMsg(fr.exceptions.conflitDirecteur);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const nowIso = new Date().toISOString();
    const docNom = getDoctorantNom(target.doctorantId);
    const ensNom = getEncadrantNom(target.encadrantId);

    ajouterNotification({
      destinataireId: target.encadrantId,
      texte: fr.reinscription.notifRelanceEncadrant.replace('{doctorant}', docNom),
      type: 'action',
      actionLabel: 'Valider',
      actionTab: 'dossier',
    });

    logEvent(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      fr.journalActions.relanceEncadrantReinscription,
      ensNom,
      `Rapport de ${docNom} (${target.titre})`
    );

    const updated = rapports.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          relanceLe: nowIso,
          relanceEncadrantLe: nowIso,
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Directeur de structure',
              action: `Relance envoyée à l'encadrant (${ensNom}) pour validation`,
            },
          ],
        };
      }
      return r;
    });

    saveList(updated, fr.reinscription.relanceEncadrantToast);
  };

  // Filtrer les rapports à traiter par le CED : tous les dossiers actifs
  // Les rapports en retard (> 48 h sans action) passent en premier
  const comiteReports = [...rapports]
    .filter(
      (r) =>
        r.statut === 'soumis' ||
        r.statut === 'avis_comite' ||
        r.statut === 'valide_ced' ||
        r.statut === 'a_corriger'
    )
    .sort((a, b) => {
      const aRetard = isRapportEnRetard(a);
      const bRetard = isRapportEnRetard(b);
      if (aRetard && !bRetard) return -1;
      if (!aRetard && bRetard) return 1;
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.reinscription.cedTitle}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {fr.reinscription.cedSubtitle}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center font-bold">
          <Award size={18} />
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {comiteReports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          {fr.reinscription.cedEmptyList}
        </div>
      ) : (
        <div className="space-y-3">
          {comiteReports.map((report) => {
            const isEnRetard = isRapportEnRetard(report);
            const votes = report.comite || [];
            const favorableCount = votes.filter((v) => v.avis === 'FAVORABLE').length;
            const defavorableCount = votes.filter((v) => v.avis === 'DEFAVORABLE').length;
            const pendingCount = votes.filter((v) => !v.avis).length;

            const hasDefavorable = defavorableCount > 0;
            const canValidate = votes.length === 3 && favorableCount === 3 && report.statut !== 'valide_ced';
            const isAlreadyValidated = report.statut === 'valide_ced';
            const isExpanded = expandedId === report.id;
            const motifInput = rectifMotifs[report.id] || '';
            const isDirecteurOfRapport = Boolean(
              connectedDirecteurId && report.encadrantId && connectedDirecteurId === report.encadrantId
            );
            const isEnAttenteEncadrant = report.statut === 'soumis';
            const isEncadrantRelance = Boolean((report as any).relanceEncadrantLe || report.relanceLe);

            return (
              <div
                key={report.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
              >
                {/* Résumé supérieur */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        {report.titre}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {report.annee}ᵉ année
                      </span>
                      {isEnRetard && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Clock size={11} className="text-rose-600 shrink-0" />
                          <span>{fr.reinscription.badgeEnRetard}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Doctorant : <span className="font-semibold text-slate-900">{getDoctorantNom(report.doctorantId)}</span> • Encadrant : <span className="font-semibold text-slate-900">{getEncadrantNom(report.encadrantId)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start">
                    {isAlreadyValidated ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={13} className="text-emerald-700" />
                        <span>Réinscription validée</span>
                      </span>
                    ) : isEnAttenteEncadrant ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock size={13} className="text-amber-600" />
                          <span>{fr.reinscription.etapeEnAttenteEncadrant}</span>
                        </span>
                        {isEncadrantRelance ? (
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                          >
                            <span>Relancé le {formatDateJJMM((report as any).relanceEncadrantLe || report.relanceLe)}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isDirecteurOfRapport}
                            onClick={() => !isDirecteurOfRapport && handleRelancerEncadrant(report.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
                              isDirecteurOfRapport
                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer active:scale-98'
                            }`}
                          >
                            <Send size={12} />
                            <span>Relancer</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Clock size={13} className="text-indigo-600" />
                        <span>En avis comité</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Détails"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* LES 3 AVIS DU COMITÉ DE THÈSE */}
                {votes.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <span>{fr.reinscription.comiteVotesSummaryTitle}</span>
                      <span className="font-bold text-slate-800">
                        {favorableCount}/3 favorables
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {votes.map((vote, idx) => {
                        const isEnAttente = !vote.avis;
                        const relanceMembreDate = (vote as any).relanceLe;

                        return (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5"
                          >
                            <p className="font-semibold text-slate-900 truncate" title={vote.membre}>
                              {vote.membre}
                            </p>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              {vote.avis === 'FAVORABLE' ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Favorable
                                </span>
                              ) : vote.avis === 'DEFAVORABLE' ? (
                                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  Défavorable
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    En attente
                                  </span>
                                  {relanceMembreDate ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                                    >
                                      Relancé le {formatDateJJMM(relanceMembreDate)}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRelancerMembreComite(report.id, idx)}
                                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-xs active:scale-98"
                                    >
                                      Relancer
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {vote.commentaire && (
                              <p className="text-[10px] text-slate-600 italic line-clamp-2">
                                « {vote.commentaire} »
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DÉTAILS DÉPLIABLES */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-700">Avancement :</span>
                      <p className="text-slate-600 mt-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                        {report.avancement || 'Aucun avancement spécifié.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center py-1">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="font-bold text-slate-900">{report.publications?.length || 0}</span>
                        <p className="text-[10px] text-slate-500">Publications</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="font-bold text-slate-900">{report.communications?.length || 0}</span>
                        <p className="text-[10px] text-slate-500">Communications</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200">
                        <span className="font-bold text-slate-900">{report.formationsHeures || 0} h</span>
                        <p className="text-[10px] text-slate-500">Formations</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* BOUTONS D'ARBITRAGE DU CED (SEULEMENT SI NON ENCORE VALIDÉ ET ÉTAPE AVIS COMITÉ) */}
                {!isAlreadyValidated && report.statut === 'avis_comite' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5">
                      {/* Bouton Valider la réinscription */}
                      <div className="flex-1 flex flex-col items-start">
                        <button
                          type="button"
                          disabled={!canValidate}
                          onClick={() => handleValider(report.id)}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            canValidate
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs active:scale-98'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 size={15} />
                          <span>{fr.reinscription.btnValiderCed}</span>
                        </button>
                        {!canValidate && (
                          <span className="text-[10px] text-slate-500 font-medium mt-1">
                            {hasDefavorable
                              ? fr.reinscription.defavorablePresentReason
                              : fr.reinscription.allFavorableRequiredReason.replace(
                                  '{count}',
                                  String(favorableCount)
                                )}
                          </span>
                        )}
                      </div>

                      {/* Bouton Pour rectification */}
                      <div className="flex-1 flex flex-col items-stretch space-y-1">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={motifInput}
                            onChange={(e) =>
                              setRectifMotifs({ ...rectifMotifs, [report.id]: e.target.value })
                            }
                            placeholder={fr.reinscription.rectificationMotifPlaceholder}
                            className="flex-1 text-xs px-2.5 py-2 border border-slate-200 rounded-lg bg-white"
                          />
                          <button
                            type="button"
                            disabled={!motifInput.trim()}
                            onClick={() => handleRectifier(report.id)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                              motifInput.trim()
                                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs active:scale-98'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            <span>{fr.reinscription.btnPourRectification}</span>
                          </button>
                        </div>
                        {!motifInput.trim() && (
                          <span className="text-[10px] text-slate-400">
                            {fr.reinscription.rectificationMotifRequired}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
