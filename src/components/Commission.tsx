import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  XCircle,
  FileSignature,
  FileCheck2,
  AlertCircle,
  Calendar,
  Lock,
  Edit2,
  Eye,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import { Creneau, Resultat, ResultatType, PV, Candidat } from '../types';
import { MOCK_CANDIDATS, INITIAL_CRENEAUX } from '../data/mockData';
import { PVDocument } from './PVDocument';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';

interface CommissionProps {
  enseignantId: string;
  enseignantNom: string;
}

function generatePVCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buffer = new Uint8Array(12);
  window.crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => chars[b % chars.length]).join('');
}

export const Commission: React.FC<CommissionProps> = ({
  enseignantId,
  enseignantNom,
}) => {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [activePV, setActivePV] = useState<PV | null>(null);

  // Formulaire d'évaluation en cours par créneau
  const [editForms, setEditForms] = useState<
    Record<
      string,
      {
        note: string;
        resultat: ResultatType;
        motif: string;
        error?: string;
      }
    >
  >({});
  const [openForms, setOpenForms] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const [reopenModalDate, setReopenModalDate] = useState<string | null>(null);
  const [reopenMotif, setReopenMotif] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Chargement des données avec persistance localStorage et try/catch
  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [enseignantId]);

  const loadData = () => {
    // 1. Créneaux
    let allCreneaux: Creneau[] = [];
    try {
      const raw = localStorage.getItem('usmba_doctorat_creneaux');
      if (raw) {
        allCreneaux = JSON.parse(raw);
      } else {
        allCreneaux = INITIAL_CRENEAUX;
      }
    } catch {
      allCreneaux = INITIAL_CRENEAUX;
    }

    // Assurer que les créneaux de démo cr-201 et cr-202 sont bien présents
    const hasDemo201 = allCreneaux.some((c) => c.id === 'cr-201');
    const hasDemo202 = allCreneaux.some((c) => c.id === 'cr-202');
    if (!hasDemo201 || !hasDemo202) {
      const missing = INITIAL_CRENEAUX.filter(
        (c) => (c.id === 'cr-201' && !hasDemo201) || (c.id === 'cr-202' && !hasDemo202)
      );
      allCreneaux = [...missing, ...allCreneaux];
      try {
        localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify(allCreneaux));
      } catch {}
    }

    setCreneaux(allCreneaux.filter((c) => c.enseignantId === enseignantId));

    // 2. Résultats
    try {
      const rawRes = localStorage.getItem('usmba_doctorat_resultats');
      if (rawRes) {
        setResultats(JSON.parse(rawRes));
      }
    } catch {}

    // 3. PVs
    try {
      const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
      if (rawPvs) {
        setPvs(JSON.parse(rawPvs));
      }
    } catch {}
  };

  const getCandidat = (candidatId?: string): Candidat | undefined => {
    if (!candidatId) return undefined;
    let found = MOCK_CANDIDATS.find((c) => c.id === candidatId);
    if (!found) {
      try {
        const raw = localStorage.getItem('usmba_doctorat_candidat');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.id === candidatId) found = parsed;
        }
      } catch {}
    }
    if (!found) {
      try {
        const rawAccounts = localStorage.getItem('usmba_registered_accounts');
        if (rawAccounts) {
          const accs = JSON.parse(rawAccounts);
          found = accs.find((a: any) => a.id === candidatId);
        }
      } catch {}
    }
    return found;
  };

  const getCandidatNom = (candidatId?: string): string => {
    if (!candidatId) return 'Candidat inconnu';
    const c = getCandidat(candidatId);
    return c?.nom || candidatId;
  };

  // Filtrer les créneaux confirmés de cet enseignant
  const creneauxConfirmes = creneaux.filter((c) => c.statut === 'confirme');

  // Vérifier et obtenir la dernière version de PV pour une date donnée
  const getLatestPVForDate = (date: string): PV | undefined => {
    const sessionPVs = pvs.filter((p) => p.date === date && p.directeurId === enseignantId);
    if (sessionPVs.length === 0) return undefined;
    const active = sessionPVs.find((p) => !p.remplaceePar);
    if (active) return active;
    return [...sessionPVs].sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
  };

  // Liste des versions précédentes remplacées (lecture seule)
  const getReplacedPVsForDate = (date: string): PV[] => {
    return pvs
      .filter((p) => p.date === date && p.directeurId === enseignantId && Boolean(p.remplaceePar))
      .sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
  };

  const getPVForDate = getLatestPVForDate;

  // Obtenir le résultat d'un créneau
  const getResultatForCreneau = (creneauId: string): Resultat | undefined => {
    return resultats.find((r) => r.creneauId === creneauId);
  };

  // Initialiser ou mettre à jour le formulaire d'évaluation pour un créneau
  const initFormForCreneau = (c: Creneau) => {
    const existing = getResultatForCreneau(c.id);
    setEditForms((prev) => ({
      ...prev,
      [c.id]: {
        note: existing ? String(existing.note) : '',
        resultat: existing ? existing.resultat : 'ADMIS',
        motif: existing?.motif || '',
      },
    }));
    setOpenForms((prev) => ({ ...prev, [c.id]: true }));
  };

  const handleFieldChange = (
    creneauId: string,
    field: 'note' | 'resultat' | 'motif',
    value: string
  ) => {
    setEditForms((prev) => {
      const cur = prev[creneauId] || {
        note: '',
        resultat: 'ADMIS',
        motif: '',
      };
      return {
        ...prev,
        [creneauId]: {
          ...cur,
          [field]: value,
          error: undefined,
        },
      };
    });
  };

  const handleSaveResultat = (creneau: Creneau) => {
    const form = editForms[creneau.id];
    if (!form) return;

    // Validation note : obligatoire, 0 à 20, 1 décimale
    const cleanNoteStr = form.note.trim().replace(',', '.');
    const noteNum = parseFloat(cleanNoteStr);
    const validNoteFormat = /^(?:20(?:\.0)?|1?[0-9](?:\.[0-9])?)$/.test(cleanNoteStr);

    if (isNaN(noteNum) || noteNum < 0 || noteNum > 20 || !validNoteFormat) {
      setEditForms((prev) => ({
        ...prev,
        [creneau.id]: {
          ...form,
          error: fr.commission.noteInvalid,
        },
      }));
      return;
    }

    // Validation motif : obligatoire et 5 caractères minimum seulement si Refusé
    if (form.resultat === 'REFUSE') {
      const cleanMotif = form.motif.trim();
      if (!cleanMotif || cleanMotif.length < 5) {
        setEditForms((prev) => ({
          ...prev,
          [creneau.id]: {
            ...form,
            error: fr.commission.motifRequired,
          },
        }));
        return;
      }
    }

    // Sauvegarde du résultat
    const nouveauResultat: Resultat = {
      creneauId: creneau.id,
      candidatId: creneau.candidatId || '',
      note: Math.round(noteNum * 10) / 10,
      resultat: form.resultat,
      motif: form.resultat === 'REFUSE' ? form.motif.trim() : undefined,
      saisiLe: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem('usmba_doctorat_resultats');
      const curList: Resultat[] = raw ? JSON.parse(raw) : [];
      const filtered = curList.filter((r) => r.creneauId !== creneau.id);
      filtered.push(nouveauResultat);
      localStorage.setItem('usmba_doctorat_resultats', JSON.stringify(filtered));
      setResultats(filtered);
      logEvent({ id: enseignantId, nom: enseignantNom, role: 'enseignant' }, fr.journalActions.candidatureValidee, `Candidat ${creneau.candidatId || ''} (${form.resultat})`);

      // Fermer le formulaire
      setOpenForms((prev) => ({ ...prev, [creneau.id]: false }));
      setFeedback({ id: creneau.id, text: fr.commission.resultSaved });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setEditForms((prev) => ({
        ...prev,
        [creneau.id]: {
          ...form,
          error: 'Erreur de stockage localStorage.',
        },
      }));
    }
  };

  // Regroupement par date pour la section Séances
  const seancesParDate = creneauxConfirmes.reduce((acc, c) => {
    if (!acc[c.date]) {
      acc[c.date] = [];
    }
    acc[c.date].push(c);
    return acc;
  }, {} as Record<string, Creneau[]>);

  const datesSeances = Object.keys(seancesParDate).sort();

  // Génération ou régénération d'une nouvelle version de PV
  const handleGeneratePV = (date: string, creneauxDate: Creneau[]) => {
    const existing = getLatestPVForDate(date);
    if (existing && !existing.rouvertLe) {
      setActivePV(existing);
      return;
    }

    // Vérifier que tous les créneaux ont un résultat
    const resultatsDate = creneauxDate.map((c) => getResultatForCreneau(c.id));
    const allHaveResult = resultatsDate.every((r) => r !== undefined);
    if (!allHaveResult) return;

    // Copie figée des résultats
    const frozenResults: Resultat[] = resultatsDate as Resultat[];
    const newCode = generatePVCode();
    const nowIso = new Date().toISOString();

    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];

      if (existing && existing.rouvertLe) {
        // Régénération après réouverture : version = ancienne version + 1
        const nextVersion = (existing.version ?? 1) + 1;
        const newId = `pv-${Date.now()}`;
        existing.remplaceePar = newId;

        const newPV: PV = {
          id: newId,
          directeurId: enseignantId,
          date,
          resultats: frozenResults,
          statut: 'a_signer',
          code: newCode,
          genereLe: nowIso,
          version: nextVersion,
        };

        const idx = curPvs.findIndex((p) => p.id === existing.id);
        if (idx !== -1) {
          curPvs[idx] = existing;
        }
        curPvs.push(newPV);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs);
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        setActivePV(newPV);
      } else {
        // Première version
        const newPV: PV = {
          id: `pv-${Date.now()}`,
          directeurId: enseignantId,
          date,
          resultats: frozenResults,
          statut: 'a_signer',
          code: newCode,
          genereLe: nowIso,
          version: 1,
        };
        curPvs.push(newPV);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs);
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        setActivePV(newPV);
      }
      logEvent({ id: enseignantId, nom: enseignantNom, role: 'enseignant' }, fr.journalActions.pvGenere, `PV séance du ${date} (Code ${newCode})`);
    } catch {}
  };

  // Réouverture d'un PV avec motif obligatoire (5 caractères min.)
  const handleConfirmReopen = (date: string) => {
    const cleanMotif = (reopenMotif || '').trim();
    if (cleanMotif.length < 5) {
      setReopenError(fr.commission.reopenMotifMinError);
      return;
    }

    const target = getLatestPVForDate(date);
    if (!target) return;
    if (target.publieLe) {
      setReopenError(fr.commission.reopenDisabledPublished);
      return;
    }

    target.rouvertLe = new Date().toISOString();
    target.motifReouverture = cleanMotif;

    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === target.id);
      if (idx !== -1) {
        curPvs[idx] = target;
      } else {
        curPvs.push(target);
      }
      localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
      setPvs(curPvs);
      window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
      setReopenModalDate(null);
      setReopenMotif('');
      setReopenError(null);
    } catch {
      setReopenError('Erreur de stockage');
    }
  };

  const renderStatusBadgeResultat = (res: ResultatType) => {
    switch (res) {
      case 'ADMIS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span>{fr.commission.resultats.ADMIS}</span>
          </span>
        );
      case 'LISTE_COMPLEMENTAIRE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock size={13} className="text-amber-600 shrink-0" />
            <span>{fr.commission.resultats.LISTE_COMPLEMENTAIRE}</span>
          </span>
        );
      case 'REFUSE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle size={13} className="text-rose-600 shrink-0" />
            <span>{fr.commission.resultats.REFUSE}</span>
          </span>
        );
      default:
        return <span>{res}</span>;
    }
  };

  // Si affichage plein écran du PVDocument
  if (activePV) {
    return (
      <PVDocument
        pv={activePV}
        directeurNom={enseignantNom}
        onClose={() => setActivePV(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight">
              {fr.commission.title}
            </h2>
            <p className="text-xs text-slate-500">{fr.commission.subtitle}</p>
          </div>
        </div>
      </div>

      {/* SECTION 1 : ENTRETIENS À ÉVALUER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <span>{fr.commission.evalSectionTitle}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
              {creneauxConfirmes.length}
            </span>
          </h3>
        </div>

        {creneauxConfirmes.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
            {fr.commission.evalSectionEmpty}
          </div>
        ) : (
          <div className="space-y-3">
            {creneauxConfirmes.map((c) => {
              const res = getResultatForCreneau(c.id);
              const pvSeance = getPVForDate(c.date);
              const isLocked = Boolean(pvSeance && !pvSeance.rouvertLe);
              const isFormOpen = openForms[c.id] || (!res && !isLocked);
              const form = editForms[c.id] || {
                note: res ? String(res.note) : '',
                resultat: res ? res.resultat : 'ADMIS',
                motif: res?.motif || '',
              };
              const candidatNom = getCandidatNom(c.candidatId);

              return (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 transition"
                >
                  {/* Ligne En-tête du créneau */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{candidatNom}</span>
                        {isLocked ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                            title={fr.commission.resultsLocked}
                          >
                            <Lock size={10} />
                            <span>{fr.commission.resultsLocked}</span>
                          </span>
                        ) : pvSeance?.rouvertLe ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                            title={fr.commission.reopenedBadge}
                          >
                            <RotateCcw size={10} />
                            <span>{fr.commission.reopenedBadge}</span>
                          </span>
                        ) : null}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {c.date} à {c.heure} — {c.lieu}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {res && renderStatusBadgeResultat(res.resultat)}
                      {res && !isLocked && !isFormOpen && (
                        <button
                          type="button"
                          onClick={() => initFormForCreneau(c)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                        >
                          <Edit2 size={12} />
                          <span>{fr.commission.btnEditResult}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Résultat existant (mode lecture si formulaire fermé) */}
                  {res && !isFormOpen && (
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium">Note attribuée :</span>{' '}
                        <span className="font-extrabold text-emerald-800 text-sm">
                          {res.note.toFixed(1)} / 20
                        </span>
                        {res.motif && (
                          <p className="text-[11px] text-slate-600 mt-1">
                            <span className="font-semibold text-slate-700">Motif :</span> {res.motif}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Saisi le {new Date(res.saisiLe).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}

                  {/* Message de confirmation rapide */}
                  {feedback && feedback.id === c.id && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>{feedback.text}</span>
                    </div>
                  )}

                  {/* Formulaire d'évaluation (ouvert si non évalué ou si modification) */}
                  {isFormOpen && !isLocked && (
                    <div className="pt-2 space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Champ Note */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.commission.noteLabel} *
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={form.note}
                            onChange={(e) => handleFieldChange(c.id, 'note', e.target.value)}
                            placeholder={fr.commission.notePlaceholder}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                          />
                        </div>

                        {/* Liste Résultat */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.commission.resultatLabel} *
                          </label>
                          <select
                            value={form.resultat}
                            onChange={(e) =>
                              handleFieldChange(c.id, 'resultat', e.target.value as ResultatType)
                            }
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                          >
                            <option value="ADMIS">{fr.commission.resultats.ADMIS}</option>
                            <option value="LISTE_COMPLEMENTAIRE">
                              {fr.commission.resultats.LISTE_COMPLEMENTAIRE}
                            </option>
                            <option value="REFUSE">{fr.commission.resultats.REFUSE}</option>
                          </select>
                        </div>
                      </div>

                      {/* Champ Motif (obligatoire et affiché seulement si Refusé) */}
                      {form.resultat === 'REFUSE' && (
                        <div>
                          <label className="block text-[11px] font-bold text-rose-700 mb-1">
                            {fr.commission.motifLabel} *
                          </label>
                          <input
                            type="text"
                            value={form.motif}
                            onChange={(e) => handleFieldChange(c.id, 'motif', e.target.value)}
                            placeholder={fr.commission.motifPlaceholder}
                            className="w-full text-xs p-2 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                      )}

                      {/* Message d'erreur de validation du formulaire */}
                      {form.error && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{form.error}</span>
                        </div>
                      )}

                      {/* Boutons d'action */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {res && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenForms((prev) => ({ ...prev, [c.id]: false }))
                            }
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          >
                            Annuler
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveResultat(c)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
                        >
                          {fr.commission.btnSaveResult}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2 : SÉANCES */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <span>{fr.commission.sessionsSectionTitle}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
              {datesSeances.length}
            </span>
          </h3>
        </div>

        {datesSeances.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
            {fr.commission.sessionsSectionEmpty}
          </div>
        ) : (
          <div className="space-y-3">
            {datesSeances.map((date) => {
              const creneauxDate = seancesParDate[date];
              const existingPV = getPVForDate(date);
              const unassessedCount = creneauxDate.filter(
                (c) => !getResultatForCreneau(c.id)
              ).length;
              const allEvaluated = unassessedCount === 0;

              return (
                <div
                  key={date}
                  className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {fr.commission.sessionDate} {date}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {creneauxDate.length} {fr.commission.totalEntretiens}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {existingPV ? (
                        existingPV.rouvertLe ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <RotateCcw size={13} className="text-amber-600" />
                            <span>{fr.commission.reopenedBadge}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <FileSignature size={13} className="text-emerald-600" />
                            <span>{fr.commission.pvStatuts.a_signer}</span>
                          </span>
                        )
                      ) : allEvaluated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={12} />
                          <span>Prête pour PV</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertCircle size={12} />
                          <span>
                            {unassessedCount}{' '}
                            {unassessedCount > 1
                              ? fr.commission.unassessedInterviewsPlural
                              : fr.commission.unassessedInterviews}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Liste des candidats de la séance */}
                  <div className="text-xs text-slate-600 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Candidats convoqués :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {creneauxDate.map((c) => {
                        const hasRes = Boolean(getResultatForCreneau(c.id));
                        return (
                          <span
                            key={c.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                              hasRes
                                ? 'bg-slate-50 border-slate-200 text-slate-800'
                                : 'bg-amber-50/50 border-amber-200 text-amber-900'
                            }`}
                          >
                            <span>{getCandidatNom(c.candidatId)}</span>
                            <span className="text-[10px] text-slate-400">({c.heure})</span>
                            {hasRes && <CheckCircle2 size={12} className="text-emerald-600" />}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Alerte si séance rouverte */}
                  {existingPV?.rouvertLe && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <RotateCcw size={13} className="text-amber-700" />
                        <span>{fr.commission.reopenedNotice}</span>
                      </div>
                      {existingPV.motifReouverture && (
                        <p className="text-[11px] text-amber-800 italic">
                          Motif : « {existingPV.motifReouverture} »
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action PV : Générer, Consulter, Rouvrir ou Régénérer */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {existingPV ? (
                      <>
                        <div className="space-y-0.5 text-xs text-slate-500">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="font-bold text-slate-900">
                              PV-{existingPV.date}-{(existingPV.code || '').slice(0, 4)}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-semibold text-slate-700 font-sans">
                              Version {existingPV.version ?? 1}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Code : {existingPV.code}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          {/* Consulter le PV */}
                          <button
                            type="button"
                            onClick={() => setActivePV(existingPV)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>
                              {existingPV.rouvertLe
                                ? `Consulter (v${existingPV.version ?? 1})`
                                : fr.commission.btnViewPV}
                            </span>
                          </button>

                          {/* Si le PV est rouvert : Bouton Régénérer */}
                          {existingPV.rouvertLe ? (
                            <button
                              type="button"
                              onClick={() => handleGeneratePV(date, creneauxDate)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
                            >
                              <FileSignature size={14} />
                              <span>{fr.commission.btnRegeneratePV}</span>
                            </button>
                          ) : (
                            /* Si non rouvert : Bouton Rouvrir */
                            <div className="flex flex-col items-end">
                              {existingPV.publieLe ? (
                                <>
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                  >
                                    <RotateCcw size={13} />
                                    <span>{fr.commission.btnReopenPV}</span>
                                  </button>
                                  <span className="text-[10px] text-rose-600 font-medium mt-1">
                                    {fr.commission.reopenDisabledPublished}
                                  </span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReopenModalDate(date);
                                    setReopenMotif('');
                                    setReopenError(null);
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>{fr.commission.btnReopenPV}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-slate-500">
                          {!allEvaluated ? (
                            <span className="text-amber-700 font-medium flex items-center gap-1.5">
                              <AlertCircle size={14} />
                              <span>
                                {unassessedCount}{' '}
                                {unassessedCount > 1
                                  ? fr.commission.unassessedInterviewsPlural
                                  : fr.commission.unassessedInterviews}
                              </span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                              <CheckCircle2 size={14} />
                              <span>Tous les entretiens de cette séance sont évalués.</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!allEvaluated}
                          onClick={() => handleGeneratePV(date, creneauxDate)}
                          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer ${
                            allEvaluated
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <FileSignature size={14} />
                          <span>{fr.commission.btnGeneratePV}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Formulaire de saisie du motif de réouverture */}
                  {reopenModalDate === date && (
                    <div className="mt-3 p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3">
                      <div>
                        <h5 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <RotateCcw size={14} className="text-amber-700" />
                          <span>{fr.commission.reopenModalTitle}</span>
                        </h5>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          {fr.commission.reopenModalSubtitle}
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {fr.commission.reopenMotifLabel} *
                        </label>
                        <input
                          type="text"
                          value={reopenMotif}
                          onChange={(e) => {
                            setReopenMotif(e.target.value);
                            setReopenError(null);
                          }}
                          placeholder={fr.commission.reopenMotifPlaceholder}
                          className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {reopenError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{reopenError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReopenModalDate(null);
                            setReopenMotif('');
                            setReopenError(null);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmReopen(date)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs transition cursor-pointer"
                        >
                          {fr.commission.btnConfirmReopen}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Versions précédentes remplacées (lecture seule, sans aucune action) */}
                  {getReplacedPVsForDate(date).length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <RotateCcw size={12} className="text-slate-400" />
                        <span>{fr.commission.previousVersionsTitle}</span>
                      </h5>
                      <div className="space-y-1.5">
                        {getReplacedPVsForDate(date).map((oldPv) => {
                          const oldRef = `PV-${oldPv.date}-${(oldPv.code || '').slice(0, 4)}`;
                          const oldVer = oldPv.version ?? 1;
                          return (
                            <div
                              key={oldPv.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold font-mono text-slate-800">{oldRef}</span>
                                  <span className="text-slate-600 font-medium">Version {oldVer}</span>
                                  {/* Badge Remplacée (texte + icône + couleur) */}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                                    <RotateCcw size={10} className="text-slate-500" />
                                    <span>{fr.commission.replacedBadge}</span>
                                  </span>
                                </div>
                                {oldPv.motifReouverture && (
                                  <p className="text-[11px] text-slate-500 italic">
                                    Motif : « {oldPv.motifReouverture} »
                                  </p>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 self-start sm:self-auto">
                                Code : {oldPv.code}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
