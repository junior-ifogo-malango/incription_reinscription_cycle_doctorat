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
} from 'lucide-react';
import { Rapport } from '../types';
import { INITIAL_RAPPORTS } from '../data/mockData';
import { fr } from '../i18n/fr';

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
              acteur: 'Direction CED / Établissement',
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
              auteur: 'Direction CED',
              date: todayStr,
              texte: `Rectification demandée : ${motif}`,
            },
          ],
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Direction CED',
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

  // Filtrer les rapports à traiter par le CED : statut 'avis_comite' (ou 'valide_ced')
  const comiteReports = rapports.filter((r) => r.statut === 'avis_comite' || r.statut === 'valide_ced');

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
            const votes = report.comite || [];
            const favorableCount = votes.filter((v) => v.avis === 'FAVORABLE').length;
            const defavorableCount = votes.filter((v) => v.avis === 'DEFAVORABLE').length;
            const pendingCount = votes.filter((v) => !v.avis).length;

            const hasDefavorable = defavorableCount > 0;
            const canValidate = votes.length === 3 && favorableCount === 3 && report.statut !== 'valide_ced';
            const isAlreadyValidated = report.statut === 'valide_ced';
            const isExpanded = expandedId === report.id;
            const motifInput = rectifMotifs[report.id] || '';

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
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Doctorant : <span className="font-semibold">{report.doctorantId}</span> • Encadrant : <span className="font-semibold">{report.encadrantId}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start">
                    {isAlreadyValidated ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={13} className="text-emerald-700" />
                        <span>Réinscription validée</span>
                      </span>
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
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <span>{fr.reinscription.comiteVotesSummaryTitle}</span>
                    <span className="font-bold text-slate-800">
                      {favorableCount}/3 favorables
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {votes.map((vote, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1"
                      >
                        <p className="font-semibold text-slate-900 truncate" title={vote.membre}>
                          {vote.membre}
                        </p>
                        <div className="flex items-center justify-between">
                          {vote.avis === 'FAVORABLE' ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Favorable
                            </span>
                          ) : vote.avis === 'DEFAVORABLE' ? (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Défavorable
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              En attente
                            </span>
                          )}
                        </div>
                        {vote.commentaire && (
                          <p className="text-[10px] text-slate-600 italic line-clamp-2">
                            « {vote.commentaire} »
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

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

                {/* BOUTONS D'ARBITRAGE DU CED (SEULEMENT SI NON ENCORE VALIDÉ) */}
                {!isAlreadyValidated && (
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
