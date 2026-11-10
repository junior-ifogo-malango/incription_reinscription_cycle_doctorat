import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  XCircle,
  ChevronDown,
  AlertCircle,
  Award,
} from 'lucide-react';
import { Periode, HistoriqueFinPeriode, Sujet } from '../types';
import {
  getPeriodeCandidature,
  savePeriodeCandidature,
  aujourdhui,
  getDirectorStructure,
  formatDateJJMM,
  INITIAL_ENSEIGNANTS,
  getComptes,
} from '../data/mockData';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';
import { storageService } from '../services/storage';
import { ajouterNotification } from '../utils/messages';

export const CedSujets: React.FC = () => {
  const [periode, setPeriode] = useState<Periode>(() => getPeriodeCandidature());
  const [isEditingFin, setIsEditingFin] = useState(false);
  const [nouvelleFinInput, setNouvelleFinInput] = useState('');
  const [motifInput, setMotifInput] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gestion des Sujets à valider par la Structure
  const [sujets, setSujets] = useState<Sujet[]>(() => {
    try {
      return storageService.getSujets();
    } catch {
      return [];
    }
  });

  const [refusModalSujetId, setRefusModalSujetId] = useState<string | null>(null);
  const [refusSujetMotif, setRefusSujetMotif] = useState('');
  const [refusSujetError, setRefusSujetError] = useState<string | null>(null);

  // Section repliée Décisions récentes
  const [isDecisionsOpen, setIsDecisionsOpen] = useState(false);

  useEffect(() => {
    const handlePeriodeUpdate = () => {
      setPeriode(getPeriodeCandidature());
    };
    const handleSujetsUpdate = () => {
      try {
        setSujets(storageService.getSujets());
      } catch {}
    };
    window.addEventListener('usmba_periode_updated', handlePeriodeUpdate);
    window.addEventListener('usmba_sujets_updated', handleSujetsUpdate);
    window.addEventListener('storage', handlePeriodeUpdate);
    window.addEventListener('storage', handleSujetsUpdate);
    return () => {
      window.removeEventListener('usmba_periode_updated', handlePeriodeUpdate);
      window.removeEventListener('usmba_sujets_updated', handleSujetsUpdate);
      window.removeEventListener('storage', handlePeriodeUpdate);
      window.removeEventListener('storage', handleSujetsUpdate);
    };
  }, []);

  const getConnectedStructureName = (): string => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const acc = JSON.parse(raw);
        if (acc) {
          if (acc.email === 'ced@demo.ma') {
            return 'LISAC - FSDM Fès';
          }
          if (acc.structure && acc.structure !== 'CED USMBA') {
            return acc.structure;
          }
        }
      }
      const allComptes = getComptes();
      const cedCompte = allComptes.find((c) => c.email === 'ced@demo.ma');
      if (cedCompte?.structure) return cedCompte.structure;
    } catch {}
    return 'LISAC - FSDM Fès';
  };

  const structureName = getConnectedStructureName();

  const matchStructure = (s1?: string, s2?: string) => {
    if (!s1 || !s2) return false;
    const n1 = s1.trim().toLowerCase();
    const n2 = s2.trim().toLowerCase();
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  const getDirectorName = (enseignantId?: string): string => {
    if (!enseignantId) return fr.cedSeances.nonRenseigne;
    const ens = INITIAL_ENSEIGNANTS.find((e) => e.id === enseignantId);
    if (ens?.nom) return ens.nom;
    const comptes = getComptes();
    const cpt = comptes.find((c) => c.enseignantId === enseignantId || c.id === enseignantId);
    if (cpt?.nom) return cpt.nom;
    return fr.cedSeances.nonRenseigne;
  };

  const getStructureActeur = () => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const acc = JSON.parse(raw);
        if (acc) {
          return {
            id: acc.id || 'dir-ced',
            nom: acc.nom || 'Structure CED',
            role: 'directeur_ced' as const,
          };
        }
      }
    } catch {}
    return { id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' as const };
  };

  // Sujets à valider de la structure
  const sujetsAValider = sujets.filter((s) => {
    if (!s) return false;
    if (s.statutValidation !== 'en_validation') return false;
    const authorStructure = getDirectorStructure(s.enseignantId) || s.structure || '';
    return matchStructure(authorStructure, structureName);
  });

  // Décisions récentes (validés ou refusés de la structure)
  const decisionsRecentes = sujets.filter((s) => {
    if (!s) return false;
    if (s.statutValidation !== 'publie' && s.statutValidation !== 'refuse') return false;
    const authorStructure = getDirectorStructure(s.enseignantId) || s.structure || '';
    return matchStructure(authorStructure, structureName);
  });

  const handleSaveNouvelleFin = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!nouvelleFinInput) {
      setEditError(fr.periodeCandidature.erreurDatePosterieure.replace('{ancienne}', periode.fin));
      return;
    }

    if (nouvelleFinInput <= periode.fin) {
      setEditError(fr.periodeCandidature.erreurDatePosterieure.replace('{ancienne}', periode.fin));
      return;
    }

    if (motifInput.trim().length < 5) {
      setEditError(fr.periodeCandidature.erreurMotifCourt);
      return;
    }

    const modif: HistoriqueFinPeriode = {
      ancienne: periode.fin,
      nouvelle: nouvelleFinInput,
      motif: motifInput.trim(),
      modifieLe: aujourdhui(),
      par: 'Direction CED',
    };

    const updated: Periode = {
      ...periode,
      fin: nouvelleFinInput,
      historiqueFin: [modif, ...(periode.historiqueFin || [])],
    };

    savePeriodeCandidature(updated);
    setPeriode(updated);
    setIsEditingFin(false);
    setNouvelleFinInput('');
    setMotifInput('');
    setMessage({ type: 'success', text: fr.periodeCandidature.succesProlongation });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleValiderSujet = (sujetId: string) => {
    const target = sujets.find((s) => s.id === sujetId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const updatedSujets: Sujet[] = sujets.map((s) =>
      s.id === sujetId
        ? {
            ...s,
            statutValidation: 'publie' as const,
            dateValidation: nowIso,
            motifRefus: undefined,
          }
        : s
    );

    setSujets(updatedSujets);
    storageService.setSujets(updatedSujets);

    logEvent(
      getStructureActeur(),
      fr.journalActions.sujetValide,
      target.titre || fr.cedSeances.nonRenseigne
    );

    if (target.enseignantId) {
      ajouterNotification({
        destinataireId: target.enseignantId,
        texte: `Votre sujet "${target.titre || fr.cedSeances.nonRenseigne}" a été validé et publié.`,
        type: 'info',
      });
    }

    window.dispatchEvent(new CustomEvent('usmba_sujets_updated'));
    setMessage({ type: 'success', text: fr.cedSeances.sujetValideToast });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOpenRefusSujet = (sujetId: string) => {
    setRefusModalSujetId(sujetId);
    setRefusSujetMotif('');
    setRefusSujetError(null);
  };

  const handleConfirmerRefusSujet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refusModalSujetId) return;

    const cleanMotif = refusSujetMotif.trim();
    if (cleanMotif.length < 5) {
      setRefusSujetError(fr.cedSeances.refusSujetMotifError);
      return;
    }

    const target = sujets.find((s) => s.id === refusModalSujetId);
    if (!target) return;

    const updatedSujets: Sujet[] = sujets.map((s) =>
      s.id === refusModalSujetId
        ? {
            ...s,
            statutValidation: 'refuse' as const,
            motifRefus: cleanMotif,
          }
        : s
    );

    setSujets(updatedSujets);
    storageService.setSujets(updatedSujets);

    logEvent(
      getStructureActeur(),
      fr.journalActions.sujetRefuse,
      target.titre || fr.cedSeances.nonRenseigne,
      cleanMotif
    );

    if (target.enseignantId) {
      ajouterNotification({
        destinataireId: target.enseignantId,
        texte: `Votre sujet "${target.titre || fr.cedSeances.nonRenseigne}" a été refusé par la Structure : ${cleanMotif}`,
        type: 'info',
      });
    }

    window.dispatchEvent(new CustomEvent('usmba_sujets_updated'));
    setRefusModalSujetId(null);
    setRefusSujetMotif('');
    setRefusSujetError(null);
    setMessage({ type: 'success', text: fr.cedSeances.sujetRefuseToast });
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Toast de message */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-xs transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* En-tête : Structure rattachée */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
              {fr.cedSeances.structureTitle}
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              {structureName}
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {fr.cedSujets.subtitle}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center shrink-0">
          <BookOpen size={18} />
        </div>
      </div>

      {/* BLOC 1 : Période de candidature (en haut) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-700 shrink-0" />
              <span>{fr.periodeCandidature.title}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {fr.periodeCandidature.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsEditingFin(!isEditingFin);
              setEditError(null);
              if (!isEditingFin) {
                setNouvelleFinInput('');
                setMotifInput('');
              }
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-98"
          >
            <Clock size={14} />
            <span>{fr.periodeCandidature.btnModifierFin}</span>
          </button>
        </div>

        {/* Dates affichées */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 font-medium">{fr.periodeCandidature.dateDebut} :</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {periode.debut}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="text-emerald-800 font-medium">{fr.periodeCandidature.dateFin} :</span>
            <span className="font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
              {periode.fin}
            </span>
          </div>
        </div>

        {/* Formulaire de modification de la date de fin */}
        {isEditingFin && (
          <form onSubmit={handleSaveNouvelleFin} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {fr.periodeCandidature.nouvelleDateFinLabel} :
              </label>
              <input
                type="date"
                value={nouvelleFinInput}
                onChange={(e) => {
                  setNouvelleFinInput(e.target.value);
                  setEditError(null);
                }}
                className="w-full sm:w-auto px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono min-h-[44px]"
              />
              <p className="text-[11px] text-slate-500">
                Date actuelle de clôture : {periode.fin}.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {fr.periodeCandidature.motifLabel} :
              </label>
              <textarea
                rows={2}
                value={motifInput}
                onChange={(e) => {
                  setMotifInput(e.target.value);
                  setEditError(null);
                }}
                placeholder={fr.periodeCandidature.motifPlaceholder}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5 font-medium">
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs active:scale-98"
              >
                {fr.periodeCandidature.btnEnregistrer}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingFin(false);
                  setEditError(null);
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {fr.periodeCandidature.btnAnnuler}
              </button>
            </div>
          </form>
        )}

        {/* Historique des prolongations en liste datée */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span>{fr.periodeCandidature.historiqueTitle}</span>
          </h4>

          {periode.historiqueFin && periode.historiqueFin.length > 0 ? (
            <ul className="space-y-2">
              {periode.historiqueFin.map((item, idx) => (
                <li
                  key={`${item.modifieLe}-${idx}`}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      Prolongée du <span className="font-mono">{item.ancienne}</span> au <span className="font-mono text-emerald-800 font-bold">{item.nouvelle}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {fr.periodeCandidature.lePrefix} {item.modifieLe}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    <span className="font-medium text-slate-700">{fr.periodeCandidature.motifPrefix}</span> {item.motif}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {fr.periodeCandidature.parPrefix} {item.par}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">
              {fr.periodeCandidature.historiqueVide}
            </p>
          )}
        </div>
      </div>

      {/* BLOC 2 : Sujets à valider par la Structure */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen size={16} className="text-emerald-700 shrink-0" />
              <span>{fr.cedSujets.sectionSujetsAValider}</span>
              {sujetsAValider.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {sujetsAValider.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {fr.cedSujets.sectionSujetsAValiderSub}
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
            {structureName}
          </span>
        </div>

        {/* Liste vide : icône + « Aucun sujet en attente. » */}
        {sujetsAValider.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2">
            <CheckCircle2 size={26} className="text-emerald-500" />
            <span className="font-medium text-slate-600">{fr.cedSujets.aucunSujetEnAttente}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sujetsAValider.map((sujet) => {
              const titre = sujet.titre?.trim() ? sujet.titre : fr.cedSeances.nonRenseigne;
              const dirNom = getDirectorName(sujet.enseignantId);
              const dateRaw = sujet.dateCreation || sujet.dateValidation;
              const dateFormatted = dateRaw ? formatDateJJMM(dateRaw) : fr.cedSeances.nonRenseigne;

              return (
                <div
                  key={sujet.id}
                  className="bg-slate-50/70 border border-slate-200 hover:border-slate-300 rounded-xl p-4 space-y-3 transition shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={10} />
                          <span>{fr.mesSujets.statutEnValidation}</span>
                        </span>
                        {sujet.discipline && (
                          <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {sujet.discipline}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {titre}
                      </h4>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span>
                          <strong className="text-slate-700">{fr.cedSeances.titreDirecteur} :</strong>{' '}
                          {dirNom}
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-700">{fr.cedSeances.titreDate} :</strong>{' '}
                          {dateFormatted}
                        </span>
                      </div>
                      {sujet.descriptionCourte && (
                        <p className="mt-2 text-xs text-slate-500 italic bg-white p-2.5 rounded-lg border border-slate-200/70">
                          {sujet.descriptionCourte}
                        </p>
                      )}
                    </div>

                    {/* Boutons d'action (≥ 44px sur mobile) */}
                    <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleValiderSujet(sujet.id)}
                        className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98"
                      >
                        <CheckCircle2 size={14} />
                        <span>{fr.cedSeances.btnValider}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenRefusSujet(sujet.id)}
                        className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                      >
                        <XCircle size={14} />
                        <span>{fr.cedSeances.btnRefuser}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BLOC 3 : Section repliée « Décisions récentes » */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsDecisionsOpen(!isDecisionsOpen)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition cursor-pointer min-h-[44px]"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-slate-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900">
              {fr.cedSujets.sectionDecisionsRecentes}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {decisionsRecentes.length}
            </span>
          </div>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 shrink-0 ${
              isDecisionsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isDecisionsOpen && (
          <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 space-y-3">
            {decisionsRecentes.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3 text-center">
                {fr.cedSujets.aucuneDecisionRecente}
              </p>
            ) : (
              <div className="space-y-2.5 pt-3">
                {decisionsRecentes.map((sujet) => {
                  const titre = sujet.titre?.trim() ? sujet.titre : fr.cedSeances.nonRenseigne;
                  const dirNom = getDirectorName(sujet.enseignantId);
                  const dateRaw = sujet.dateValidation || sujet.dateCreation;
                  const dateFormatted = dateRaw ? formatDateJJMM(dateRaw) : fr.cedSeances.nonRenseigne;
                  const isValide = sujet.statutValidation === 'publie';

                  return (
                    <div
                      key={sujet.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                            {titre}
                          </h4>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                            <span>
                              <strong className="text-slate-700">{fr.cedSeances.titreDirecteur} :</strong>{' '}
                              {dirNom}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-slate-700">{fr.cedSeances.titreDate} :</strong>{' '}
                              {dateFormatted}
                            </span>
                          </div>
                        </div>

                        {/* Pastille texte + icône */}
                        {isValide ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span>{fr.cedSujets.statutValide}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
                            <XCircle size={13} className="text-rose-600 shrink-0" />
                            <span>{fr.cedSujets.statutRefuse}</span>
                          </span>
                        )}
                      </div>

                      {/* Motif si refusé */}
                      {!isValide && sujet.motifRefus && (
                        <div className="p-2.5 rounded-lg bg-rose-50/80 border border-rose-200 text-rose-900 text-[11px] space-y-0.5">
                          <span className="font-semibold">{fr.cedSujets.motifPrefix}</span> « {sujet.motifRefus} »
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de refus de sujet avec validation de motif >= 5 caractères */}
      {refusModalSujetId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <XCircle className="text-rose-600 shrink-0" size={20} />
                <h3 className="text-sm font-bold text-slate-900">
                  {fr.cedSeances.refuserSujetModalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRefusModalSujetId(null);
                  setRefusSujetMotif('');
                  setRefusSujetError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <XCircle size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmerRefusSujet} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.cedSeances.refusSujetMotifLabel} <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={refusSujetMotif}
                  onChange={(e) => {
                    setRefusSujetMotif(e.target.value);
                    if (refusSujetError && e.target.value.trim().length >= 5) {
                      setRefusSujetError(null);
                    }
                  }}
                  placeholder={fr.cedSeances.refusSujetMotifPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                {refusSujetError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">
                    {refusSujetError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setRefusModalSujetId(null);
                    setRefusSujetMotif('');
                    setRefusSujetError(null);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {fr.mesSujets.btnAnnuler}
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer active:scale-98"
                >
                  {fr.cedSeances.btnRefuser}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
