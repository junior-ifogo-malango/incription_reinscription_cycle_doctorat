import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, AlertCircle, FileText, Award, MessageCircle, Mail, Upload, FileCheck, XCircle, Calendar, CalendarCheck2, AlertTriangle, Eye } from 'lucide-react';
import { PV, Notification, Resultat, Periode, HistoriqueFinPeriode } from '../types';
import { getPeriodeCandidature, savePeriodeCandidature, aujourdhui, getConnectedDirecteurId, getDirectorStructure, enrichirPVLecture, getComptes } from '../data/mockData';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';
import {
  normaliserTel,
  lienWhatsApp,
  lienMail,
  ouvrirLien,
  isEmailValide,
  messageResultat,
  trouverCandidat,
} from '../utils/messages';

/**
 * Action de publication des résultats d'un PV par le CED.
 * Crée une notification par candidat du PV : « Ton résultat est publié. À faire : consulte l'onglet Entretiens. » avec mention « E-mail simulé ».
 * Règle stricte : Une seule publication par PV (si publieLe existe, ne rien recréer).
 */
export const publierResultatsPV = (pvId: string): { success: boolean; message?: string } => {
  try {
    const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
    let pvs: PV[] = rawPvs ? JSON.parse(rawPvs) : [];

    const pvIndex = pvs.findIndex((p) => p.id === pvId);
    if (pvIndex === -1 || pvs[pvIndex].remplaceePar) {
      return { success: false, message: 'PV introuvable ou remplacé' };
    }

    const targetPv = pvs[pvIndex];
    // Règle stricte : Une seule publication par PV
    if (targetPv.publieLe) {
      return { success: false, message: 'Ce PV est déjà publié' };
    }

    const nowIso = new Date().toISOString();
    targetPv.publieLe = nowIso;
    targetPv.statut = 'publie';
    pvs[pvIndex] = targetPv;
    localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(pvs));

    // Crée une Notification par candidat du PV
    let currentNotifs: Notification[] = [];
    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      if (rawNotifs) currentNotifs = JSON.parse(rawNotifs);
    } catch {}

    const newNotifs: Notification[] = (targetPv.resultats || []).map((res, idx) => ({
      id: `notif-pub-${targetPv.id}-${res.candidatId}-${Date.now()}-${idx}`,
      destinataireId: res.candidatId,
      texte: "Ton résultat est publié. À faire : consulte l'onglet Entretiens.",
      date: nowIso,
      lue: false,
    }));

    const updatedNotifs = [...newNotifs, ...currentNotifs];
    localStorage.setItem('usmba_notifications', JSON.stringify(updatedNotifs));

    window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
    logEvent({ id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' }, fr.journalActions.resultatsPublies, `PV-${targetPv.date}-${(targetPv.code || '').slice(0, 4)}`);

    return { success: true };
  } catch (err) {
    console.error('Storage error during PV publication', err);
    return { success: false, message: 'Erreur de stockage' };
  }
};

export const CedSeances: React.FC = () => {
  const [pvs, setPvs] = useState<PV[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [periode, setPeriode] = useState<Periode>(() => getPeriodeCandidature());
  const [isEditingFin, setIsEditingFin] = useState(false);
  const [nouvelleFinInput, setNouvelleFinInput] = useState('');
  const [motifInput, setMotifInput] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [conformiteMap, setConformiteMap] = useState<Record<string, boolean>>({});
  const [scanModalPv, setScanModalPv] = useState<PV | null>(null);
  const [refusModalPvId, setRefusModalPvId] = useState<string | null>(null);
  const [refusMotif, setRefusMotif] = useState('');
  const [refusError, setRefusError] = useState<string | null>(null);

  useEffect(() => {
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

  const loadData = () => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      if (raw) {
        const parsed: PV[] = JSON.parse(raw);
        // Ignore les versions remplacées et enrichit à la lecture sans modifier les données
        setPvs(parsed.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
      } else {
        // PV de démonstration initial prêt à être publié si aucun PV n'a encore été généré
        const demoResults: Resultat[] = [
          {
            creneauId: 'cr-201',
            candidatId: 'cand-001',
            note: 17.5,
            resultat: 'ADMIS',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-201',
            candidatId: 'cand-sara',
            note: 16.0,
            resultat: 'ADMIS',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-202',
            candidatId: 'cand-omar',
            note: 14.5,
            resultat: 'LISTE_COMPLEMENTAIRE',
            saisiLe: new Date().toISOString(),
          },
          {
            creneauId: 'cr-101',
            candidatId: 'cand-salma',
            note: 9.0,
            resultat: 'REFUSE',
            motif: 'Prérequis scientifiques et méthodologiques insuffisants',
            saisiLe: new Date().toISOString(),
          },
        ];

        const demoPV: PV = {
          id: 'pv-demo-fsdm-01',
          directeurId: 'ens-1',
          structure: 'LISAC - FSDM Fès',
          date: '2026-11-10',
          resultats: demoResults,
          statut: 'envoye',
          envoyeLe: new Date().toISOString(),
          envoyePar: 'Pr. Karim El Amrani',
          code: 'PV-2026-FSDM-001',
          genereLe: new Date().toISOString(),
          scanDeposeLe: new Date().toISOString(),
          scanStatut: 'valide',
        };

        setPvs([demoPV]);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify([demoPV]));
      }
    } catch {
      setPvs([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('usmba_account_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_account_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const connectedDirecteurId = getConnectedDirecteurId();

  const handlePublier = (pvId: string) => {
    const curPv = pvs.find((p) => p.id === pvId);
    if (connectedDirecteurId && curPv?.directeurId === connectedDirecteurId) {
      setMessage({ type: 'error', text: fr.cedSeances.conflitDirecteur });
      return;
    }
    const res = publierResultatsPV(pvId);
    if (res.success) {
      setMessage({ type: 'success', text: fr.cedSeances.notifSuccess });
      loadData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Échec de la publication' });
    }
  };

  const handleRefuserScan = (pvId: string, motif: string = 'Scan illisible ou signatures incomplètes') => {
    const curPv = pvs.find((p) => p.id === pvId);
    if (connectedDirecteurId && curPv?.directeurId === connectedDirecteurId) {
      setMessage({ type: 'error', text: fr.cedSeances.conflitDirecteur });
      return;
    }
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        // Règle : le PV repasse à 'a_signer'
        curPvs[idx].statut = 'a_signer';
        curPvs[idx].scanStatut = 'refuse';
        curPvs[idx].scanMotifRefus = motif;
        delete curPvs[idx].envoyeLe;
        delete curPvs[idx].envoyePar;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logEvent({ id: 'dir-ced', nom: 'Structure CED', role: 'directeur_ced' }, fr.journalActions.scanPvRefuse, `PV-${curPvs[idx].date}-${(curPvs[idx].code || '').slice(0, 4)}`, motif);
        setMessage({ type: 'error', text: `Scan du PV refusé : ${motif}. Le PV repasse à À signer.` });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch {}
  };

  const handleOpenRefusModal = (pvId: string) => {
    setRefusModalPvId(pvId);
    setRefusMotif('');
    setRefusError(null);
  };

  const handleConfirmRefus = () => {
    if (!refusModalPvId) return;
    const cleanMotif = (refusMotif || '').trim();
    if (cleanMotif.length < 5) {
      setRefusError(fr.cedSeances.motifRefusMinError);
      return;
    }
    handleRefuserScan(refusModalPvId, cleanMotif);
    setRefusModalPvId(null);
    setRefusMotif('');
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} à ${d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  const structureName = getConnectedStructureName();

  const pvsStructure = pvs.filter((pv) => {
    if (pv.remplaceePar) return false;
    // Déterminer la structure à la lecture
    const pvStructure = pv.structure || getDirectorStructure(pv.directeurId);
    // Cas d'erreur : structure absente -> PV invisible pour toute Structure
    if (!pvStructure) return false;
    // Ne liste que les PV avec PV.structure égale à sa structure
    if (pvStructure !== structureName) return false;

    // ET statut 'envoye' (ou 'publie'/refusé déjà traités)
    const isEnvoye = pv.statut === 'envoye';
    const isPublie = pv.statut === 'publie' || Boolean(pv.publieLe);
    const isRefuse = pv.scanStatut === 'refuse';
    const isLegacyTraite = pv.statut === 'original_recu' || pv.statut === 'approuve';

    return isEnvoye || isPublie || isRefuse || isLegacyTraite;
  });

  return (
    <div className="space-y-4">
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
            {fr.cedSeances.subtitle}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center shrink-0">
          <Award size={18} />
        </div>
      </div>

      {/* Carte Période de candidature */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3.5">
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
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Clock size={13} />
            <span>{fr.periodeCandidature.btnModifierFin}</span>
          </button>
        </div>

        {/* Dates affichées */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 font-medium">{fr.periodeCandidature.dateDebut} :</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {periode.debut}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="text-emerald-800 font-medium">{fr.periodeCandidature.dateFin} :</span>
            <span className="font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
              {periode.fin}
            </span>
          </div>
        </div>

        {/* Formulaire de modification de la date de fin */}
        {isEditingFin && (
          <form onSubmit={handleSaveNouvelleFin} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
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
                className="w-full sm:w-auto px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
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
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {editError && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5 font-medium">
                <AlertCircle size={14} className="shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
              >
                {fr.periodeCandidature.btnEnregistrer}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingFin(false);
                  setEditError(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
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

      {pvsStructure.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
          {fr.cedSeances.emptyList}
        </div>
      ) : (
        <div className="space-y-3">
          {pvsStructure.map((pv) => {
            const isPublished = Boolean(pv.publieLe) || pv.statut === 'publie';
            const isDirecteurOfPv = Boolean(
              connectedDirecteurId && pv.directeurId && connectedDirecteurId === pv.directeurId
            );
            const isEnvoyeNonPublie48h = Boolean(
              pv.statut === 'envoye' &&
              !isPublished &&
              pv.envoyeLe &&
              (Date.now() - new Date(pv.envoyeLe).getTime()) / (1000 * 60 * 60) > 48
            );

            return (
              <div
                key={pv.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                {/* Exception 5 : PV envoyé non publié depuis plus de 48 h (visible de la Structure) */}
                {isEnvoyeNonPublie48h && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2 font-semibold">
                    <Clock size={16} className="text-amber-600 shrink-0" />
                    <span>{fr.cedSeances.exceptionEnvoyeNonPublie}</span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText size={15} className="text-emerald-700" />
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        PV-{pv.date}-{(pv.code || '').slice(0, 4)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 font-sans">
                        (v{pv.version ?? 1})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {pv.structure || structureName}
                      </span>
                      {pv.statut === 'envoye' && !isPublished && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                          Envoyé par {pv.envoyePar || 'Directeur'}
                        </span>
                      )}
                      {pv.scanStatut === 'refuse' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                          Scan refusé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {fr.cedSeances.datePrefix} {pv.date} • {pv.resultats?.length || 0} {fr.cedSeances.candidatsCount} • Code : {pv.code}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Voir le scan */}
                    <button
                      type="button"
                      onClick={() => setScanModalPv(pv)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>{fr.cedSeances.btnVoirScan}</span>
                    </button>

                    {/* Refuser le scan (motif obligatoire, le PV repasse à 'a_signer') */}
                    {!isPublished && (
                      <button
                        type="button"
                        disabled={isDirecteurOfPv}
                        onClick={() => !isDirecteurOfPv && handleOpenRefusModal(pv.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isDirecteurOfPv
                            ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                            : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-98'
                        }`}
                      >
                        <XCircle size={13} />
                        <span>{fr.cedSeances.btnRefuserScan}</span>
                      </button>
                    )}

                    {/* Publication résultats */}
                    {isPublished ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>
                          {fr.cedSeances.publishedOn} {formatDate(pv.publieLe)}
                        </span>
                      </span>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled={isDirecteurOfPv || !conformiteMap[pv.id]}
                          onClick={() => !isDirecteurOfPv && conformiteMap[pv.id] && handlePublier(pv.id)}
                          className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            isDirecteurOfPv || !conformiteMap[pv.id]
                              ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98'
                          }`}
                        >
                          <Send size={13} />
                          <span>{fr.cedSeances.btnPublier}</span>
                        </button>
                        {isDirecteurOfPv && (
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 text-right max-w-xs">
                            <AlertTriangle size={12} className="shrink-0 text-amber-600" />
                            <span>{fr.cedSeances.conflitDirecteur}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Case de conformité obligatoire avant publication */}
                {!isPublished && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(conformiteMap[pv.id])}
                        onChange={(e) =>
                          setConformiteMap((prev) => ({ ...prev, [pv.id]: e.target.checked }))
                        }
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>{fr.cedSeances.conformiteLabel}</span>
                    </label>
                    {!conformiteMap[pv.id] && !isDirecteurOfPv && (
                      <span className="text-[10px] text-amber-800 font-medium">
                        Cochez la case de conformité pour activer la publication
                      </span>
                    )}
                  </div>
                )}

                {/* Liste succincte des résultats pour contrôle CED */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {pv.resultats.map((res, i) => (
                      <div key={i} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <span className="font-medium text-slate-700">{res.candidatId}</span>
                        <span
                          className={`font-bold ${
                            res.resultat === 'ADMIS'
                              ? 'text-emerald-700'
                              : res.resultat === 'LISTE_COMPLEMENTAIRE'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {res.resultat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ligne par candidat avec WhatsApp et E-mail (sur un PV publié) */}
                {isPublished && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        {fr.messages.notifierCandidatsTitle}
                      </h4>
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {pv.resultats.map((res, i) => {
                        const candidatInfo = trouverCandidat(res.candidatId);
                        const resultatText = messageResultat();

                        const hasValidTel = Boolean(
                          candidatInfo.tel && normaliserTel(candidatInfo.tel)
                        );
                        const telError = !candidatInfo.tel
                          ? fr.messages.missingPhone
                          : !normaliserTel(candidatInfo.tel)
                          ? fr.messages.invalidPhone
                          : null;

                        const hasValidEmail = Boolean(
                          candidatInfo.email && isEmailValide(candidatInfo.email)
                        );
                        const emailError = !candidatInfo.email
                          ? fr.messages.missingEmail
                          : !isEmailValide(candidatInfo.email)
                          ? fr.messages.invalidEmail
                          : null;

                        const waUrl = lienWhatsApp(candidatInfo.tel, resultatText);
                        const mailUrl = lienMail(
                          candidatInfo.email,
                          fr.messages.resultatSubject,
                          resultatText
                        );

                        return (
                          <div
                            key={i}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {candidatInfo.nom || res.candidatId}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {candidatInfo.tel || fr.messages.missingPhone} • {candidatInfo.email || fr.messages.missingEmail}
                              </p>
                            </div>

                            <div className="flex items-start gap-2 flex-wrap">
                              {/* WhatsApp */}
                              <div className="flex flex-col items-start">
                                <button
                                  type="button"
                                  disabled={!hasValidTel}
                                  onClick={() => waUrl && ouvrirLien(waUrl)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                    hasValidTel
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-98'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  }`}
                                >
                                  <MessageCircle size={13} className={hasValidTel ? 'text-white' : 'text-slate-400'} />
                                  <span>{fr.messages.btnWhatsApp}</span>
                                </button>
                                {!hasValidTel && (
                                  <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {telError}
                                  </span>
                                )}
                              </div>

                              {/* E-mail */}
                              <div className="flex flex-col items-start">
                                <button
                                  type="button"
                                  disabled={!hasValidEmail}
                                  onClick={() => mailUrl && ouvrirLien(mailUrl)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                    hasValidEmail
                                      ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs active:scale-98'
                                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  }`}
                                >
                                  <Mail size={13} className={hasValidEmail ? 'text-white' : 'text-slate-400'} />
                                  <span>{fr.messages.btnEmail}</span>
                                </button>
                                {!hasValidEmail && (
                                  <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    {emailError}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mention discrète sous les boutons */}
                    <p className="text-[10px] text-slate-500 italic px-1">
                      {fr.messages.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal : Aperçu du scan signé */}
      {scanModalPv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-emerald-700" />
                  <span>Scan du PV — PV-{scanModalPv.date}-{(scanModalPv.code || '').slice(0, 4)}</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Structure : {scanModalPv.structure || structureName} • Code : {scanModalPv.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanModalPv(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Séance du : {scanModalPv.date}</span>
                <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                  Scan signé officiel
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-2">Candidat</th>
                      <th className="p-2 text-center">Note</th>
                      <th className="p-2 text-center">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scanModalPv.resultats.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-medium text-slate-800">{r.candidatId}</td>
                        <td className="p-2 text-center font-bold text-emerald-800">{r.note} / 20</td>
                        <td className="p-2 text-center font-bold text-slate-700">{r.resultat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-white border border-dashed border-slate-300 rounded-xl flex items-center gap-3">
                <FileCheck size={20} className="text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Paraphes et signatures de la commission validés</p>
                  <p className="text-[11px] text-slate-500">
                    Déposé par le directeur le {scanModalPv.scanDeposeLe ? formatDate(scanModalPv.scanDeposeLe) : scanModalPv.date}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setScanModalPv(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Refus du scan avec motif obligatoire */}
      {refusModalPvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <XCircle size={16} className="text-rose-600" />
                <span>{fr.cedSeances.modalRefusTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRefusModalPvId(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {fr.cedSeances.motifRefusLabel} *
              </label>
              <textarea
                rows={3}
                value={refusMotif}
                onChange={(e) => {
                  setRefusMotif(e.target.value);
                  setRefusError(null);
                }}
                placeholder={fr.cedSeances.motifRefusPlaceholder}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              {refusError && (
                <p className="text-[11px] font-semibold text-rose-600">{refusError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefusModalPvId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRefus}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-700 hover:bg-rose-800 text-white shadow-xs cursor-pointer active:scale-98"
              >
                {fr.cedSeances.btnConfirmerRefus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
