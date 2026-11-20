import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, AlertCircle, FileText, Award, MessageCircle, Mail, Upload, FileCheck, XCircle, AlertTriangle, Eye, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { PV, Notification, Resultat, Compte } from '../types';
import { getConnectedDirecteurId, getDirectorStructure, enrichirPVLecture, getComptes, formatDateJJMM } from '../data/mockData';
import { storageService } from '../services/storage';
import { fr } from '../i18n/fr';
import { logEvent } from '../utils/journal';
import { sendAdmissionEmail } from '../emailConfig';
import {
  normaliserTel,
  lienWhatsApp,
  ouvrirLien,
  trouverCandidat,
} from '../utils/messages';


/**
 * Action de publication des résultats d'un PV par le CED.
 * Pour chaque candidat "Favorable" (ADMIS) : crée une notification 'action'.
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

    // Crée une Notification par candidat du PV ('action' avec message d'inscription uniquement pour Favorable/ADMIS)
    let currentNotifs: Notification[] = [];
    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      if (rawNotifs) currentNotifs = JSON.parse(rawNotifs);
    } catch {}

    const newNotifs: Notification[] = (targetPv.resultats || []).map((res, idx) => {
      if (res.resultat === 'ADMIS') {
        return {
          id: `notif-pub-${targetPv.id}-${res.candidatId}-${Date.now()}-${idx}`,
          destinataireId: res.candidatId,
          texte: fr.cedSeances.messageAdmission,
          date: nowIso,
          lue: false,
          type: 'action',
          actionLabel: fr.notifications.btnAllerEntretiens,
          actionTab: 'entretiens',
        };
      }
      return {
        id: `notif-pub-${targetPv.id}-${res.candidatId}-${Date.now()}-${idx}`,
        destinataireId: res.candidatId,
        texte: fr.notifications.resultatPublie,
        date: nowIso,
        lue: false,
        type: 'info',
      };
    });

    const updatedNotifs = [...newNotifs, ...currentNotifs];
    localStorage.setItem('usmba_notifications', JSON.stringify(updatedNotifs));

    window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
    logEvent({ id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' }, fr.journalActions.resultatsPublies, `PV-${targetPv.date}-${(targetPv.code || '').slice(0, 4)}`);

    return { success: true };
  } catch (err) {
    console.error('Storage error during PV publication', err);
    return { success: false, message: 'Erreur de stockage' };
  }
};

export const CedSeances: React.FC = () => {
  const [pvs, setPvs] = useState<PV[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [conformiteMap, setConformiteMap] = useState<Record<string, boolean>>({});
  const [scanModalPv, setScanModalPv] = useState<PV | null>(null);
  const [refusModalPvId, setRefusModalPvId] = useState<string | null>(null);
  const [refusMotif, setRefusMotif] = useState('');
  const [refusError, setRefusError] = useState<string | null>(null);
  const [sendingEmailMap, setSendingEmailMap] = useState<Record<string, boolean>>({});

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

  const formatDateJJMMAAAA = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const updatePvResultatTracking = (
    pvId: string,
    candidatId: string,
    patch: Partial<Resultat>
  ) => {
    try {
      const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
      const allPvs: PV[] = rawPvs ? JSON.parse(rawPvs) : [];
      const pvIdx = allPvs.findIndex((p) => p.id === pvId);
      if (pvIdx === -1) return;
      allPvs[pvIdx] = {
        ...allPvs[pvIdx],
        resultats: (allPvs[pvIdx].resultats || []).map((r) =>
          r.candidatId === candidatId ? { ...r, ...patch } : r
        ),
      };
      localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(allPvs));
      setPvs(allPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
      window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
    } catch {
      // safe fallback
    }
  };

  const sendRealEmailForCandidate = async (pvId: string, res: Resultat) => {
    if (res.resultat !== 'ADMIS') return;
    const key = `${pvId}:${res.candidatId}`;
    setSendingEmailMap((prev) => ({ ...prev, [key]: true }));
    try {
      const candidatInfo = trouverCandidat(res.candidatId);
      const candidatNom = getCandidatNomComplet(res.candidatId);
      const result = await sendAdmissionEmail({
        toEmail: candidatInfo.email || '',
        toName: candidatNom,
        message: fr.cedSeances.messageAdmission,
      });

      const nowIso = new Date().toISOString();
      if (result.ok) {
        updatePvResultatTracking(pvId, res.candidatId, {
          emailStatut: 'envoye',
          emailErreur: undefined,
          emailEnvoyeLe: nowIso,
        });
        logEvent(
          { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
          fr.journalActions.admissionNotifiee,
          candidatNom,
          `E-mail • ${formatDateJJMMAAAA(nowIso)} • ${fr.cedSeances.decisionAdmis}`
        );
      } else {
        updatePvResultatTracking(pvId, res.candidatId, {
          emailStatut: 'echec',
          emailErreur: result.error || fr.cedSeances.emailNetworkError,
        });
      }
    } finally {
      setSendingEmailMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleOpenWhatsAppAdmission = (pvId: string, res: Resultat, waUrl: string) => {
    if (res.resultat !== 'ADMIS') return;
    ouvrirLien(waUrl);
    const nowIso = new Date().toISOString();
    const candidatNom = getCandidatNomComplet(res.candidatId);
    updatePvResultatTracking(pvId, res.candidatId, {
      whatsappOuvertLe: nowIso,
    });
    logEvent(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      fr.journalActions.admissionNotifiee,
      candidatNom,
      `WhatsApp • ${formatDateJJMMAAAA(nowIso)} • ${fr.cedSeances.decisionAdmis}`
    );
  };

  const handlePublier = async (pvId: string) => {
    const curPv = pvs.find((p) => p.id === pvId);
    if (connectedDirecteurId && curPv?.directeurId === connectedDirecteurId) {
      setMessage({ type: 'error', text: fr.cedSeances.conflitDirecteur });
      return;
    }
    const res = publierResultatsPV(pvId);
    if (res.success) {
      setMessage({ type: 'success', text: fr.cedSeances.notifSuccess });
      loadData();
      const admisList = (curPv?.resultats || []).filter((r) => r.resultat === 'ADMIS');
      await Promise.all(admisList.map((r) => sendRealEmailForCandidate(pvId, r)));
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
        logEvent({ id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' }, fr.journalActions.scanPvRefuse, `PV-${curPvs[idx].date}-${(curPvs[idx].code || '').slice(0, 4)}`, motif);
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

  const [expandedPvIds, setExpandedPvIds] = useState<Record<string, boolean>>({});

  const togglePvExpanded = (pvId: string) => {
    setExpandedPvIds((prev) => ({ ...prev, [pvId]: !prev[pvId] }));
  };

  const getLieuForPv = (pv: PV): string => {
    try {
      const creneaux = storageService.getCreneaux();
      for (const res of pv.resultats || []) {
        if (res.creneauId) {
          const c = creneaux.find((cr) => cr.id === res.creneauId);
          if (c?.lieu) return c.lieu;
        }
      }
      const cMatch = creneaux.find(
        (cr) => cr.date === pv.date && cr.enseignantId === pv.directeurId && cr.lieu
      );
      if (cMatch?.lieu) return cMatch.lieu;
      const cDate = creneaux.find((cr) => cr.date === pv.date && cr.lieu);
      if (cDate?.lieu) return cDate.lieu;
    } catch {}
    return 'CED';
  };

  const getCandidatNomComplet = (candidatId: string): string => {
    if (!candidatId) return fr.cedSeances.nonRenseigne;
    const info = trouverCandidat(candidatId);
    const nom = info?.nom?.trim();
    if (!nom || nom.toLowerCase().includes('cand-') || nom.startsWith('Candidat (')) {
      return fr.cedSeances.nonRenseigne;
    }
    return nom;
  };

  const formatDecision = (res?: string): { label: string; className: string } => {
    if (res === 'ADMIS') {
      return { label: fr.cedSeances.decisionAdmis, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (res === 'LISTE_COMPLEMENTAIRE') {
      return { label: fr.cedSeances.decisionListeAttente, className: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (res === 'REFUSE') {
      return { label: fr.cedSeances.decisionRefuse, className: 'bg-rose-50 text-rose-800 border-rose-200' };
    }
    return { label: res || fr.cedSeances.nonRenseigne, className: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  const renderEtapeBadge = (pv: PV, isPublished: boolean) => {
    if (isPublished) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span>{fr.cedSeances.etapePublie}</span>
        </span>
      );
    }
    if (pv.scanStatut === 'refuse') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
          <XCircle size={13} className="text-rose-600 shrink-0" />
          <span>{fr.cedSeances.etapeScanRefuse}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
        <Clock size={13} className="text-sky-600 shrink-0" />
        <span>{fr.cedSeances.etapeEnAttente}</span>
      </span>
    );
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
            const isExpanded = Boolean(expandedPvIds[pv.id]);
            const lieu = getLieuForPv(pv);
            const nbCandidats = pv.resultats?.length || 0;

            return (
              <div
                key={pv.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* Carte repliée par défaut : « Séance du JJ/MM · lieu », nombre de candidats, étape en pastille texte + icône. Rien d'autre. */}
                <button
                  type="button"
                  onClick={() => togglePvExpanded(pv.id)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Séance du {formatDateJJMM(pv.date)} · {lieu}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({nbCandidats} {fr.cedSeances.candidatsCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {renderEtapeBadge(pv, isPublished)}
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-slate-700' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Au clic : volet avec Voir le scan, Refuser le scan, case de conformité, Publier (grisé avec raison écrite) et la liste des candidats */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
                    {/* Barre d'actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Voir le scan */}
                        <button
                          type="button"
                          onClick={() => setScanModalPv(pv)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition cursor-pointer min-h-[44px]"
                        >
                          <Eye size={15} />
                          <span>{fr.cedSeances.btnVoirScan}</span>
                        </button>

                        {/* Refuser le scan */}
                        {!isPublished && (
                          <button
                            type="button"
                            disabled={isDirecteurOfPv}
                            onClick={() => !isDirecteurOfPv && handleOpenRefusModal(pv.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[44px] ${
                              isDirecteurOfPv
                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-98'
                            }`}
                          >
                            <XCircle size={15} />
                            <span>{fr.cedSeances.btnRefuserScan}</span>
                          </button>
                        )}
                      </div>

                      {/* Publier (grisé avec raison écrite) */}
                      {isPublished ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span>
                            {fr.cedSeances.publishedOn} {formatDate(pv.publieLe)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <button
                            type="button"
                            disabled={isDirecteurOfPv || !conformiteMap[pv.id]}
                            onClick={() => !isDirecteurOfPv && conformiteMap[pv.id] && handlePublier(pv.id)}
                            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              isDirecteurOfPv || !conformiteMap[pv.id]
                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98 shadow-xs'
                            }`}
                          >
                            <Send size={15} />
                            <span>{fr.cedSeances.btnPublier}</span>
                          </button>
                          {isDirecteurOfPv ? (
                            <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 text-left sm:text-right max-w-xs">
                              <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                              <span>{fr.cedSeances.conflitDirecteur}</span>
                            </p>
                          ) : !conformiteMap[pv.id] ? (
                            <p className="text-[11px] font-medium text-amber-800 text-left sm:text-right max-w-xs">
                              {fr.cedSeances.raisonConformiteRequise}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Case de conformité obligatoire avant publication */}
                    {!isPublished && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
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
                          <span className="text-[11px] text-amber-800 font-medium">
                            {fr.cedSeances.raisonConformiteRequise}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Liste des candidats */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Candidats ({nbCandidats})
                      </div>
                      {pv.resultats.map((res, i) => {
                        const candidatNom = getCandidatNomComplet(res.candidatId);
                        const dec = formatDecision(res.resultat);
                        const isAdmis = res.resultat === 'ADMIS';
                        const candidatInfo = trouverCandidat(res.candidatId);
                        const hasValidTel = Boolean(candidatInfo.tel && normaliserTel(candidatInfo.tel));
                        const waUrl = isAdmis
                          ? lienWhatsApp(candidatInfo.tel, fr.cedSeances.messageAdmission)
                          : null;
                        const isSendingEmail = Boolean(sendingEmailMap[`${pv.id}:${res.candidatId}`]);

                        return (
                          <div
                            key={i}
                            className="p-3.5 flex flex-col gap-2.5 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-900">{candidatNom}</p>
                                {isPublished && (
                                  <p className="text-[11px] text-slate-500 font-mono">
                                    {candidatInfo.tel || fr.messages.missingPhone} • {candidatInfo.email || fr.messages.missingEmail}
                                  </p>
                                )}
                              </div>

                              <span className={`inline-flex items-center self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold border ${dec.className}`}>
                                {dec.label}
                              </span>
                            </div>

                            {/* Actions réelles d'admission réservées uniquement aux candidats « Favorable » (ADMIS) */}
                            {isPublished && isAdmis && (
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-2 border-t border-slate-100">
                                {/* Statut d'envoi e-mail réel + bouton Renvoyer si échec */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isSendingEmail ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
                                      <Loader2 size={14} className="animate-spin shrink-0" />
                                      <span>{fr.cedSeances.emailSendingLabel}</span>
                                    </span>
                                  ) : res.emailStatut === 'envoye' ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                      <CheckCircle2 size={14} className="shrink-0" />
                                      <span>{fr.cedSeances.emailSentLabel}</span>
                                    </span>
                                  ) : (
                                    <>
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span>
                                          {fr.cedSeances.emailFailedPrefix}{' '}
                                          {res.emailErreur || fr.cedSeances.emailNetworkError}
                                        </span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => sendRealEmailForCandidate(pv.id, res)}
                                        className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer active:scale-98 transition-colors"
                                      >
                                        <RefreshCw size={12} />
                                        <span>{fr.cedSeances.btnRenvoyerEmail}</span>
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Bouton WhatsApp réel (ou grisé avec raison écrite) + horodatage d'ouverture */}
                                <div className="flex flex-col items-start sm:items-end gap-1">
                                  <button
                                    type="button"
                                    disabled={!hasValidTel || !waUrl}
                                    onClick={() =>
                                      hasValidTel && waUrl && handleOpenWhatsAppAdmission(pv.id, res, waUrl)
                                    }
                                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                                      hasValidTel && waUrl
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-98'
                                        : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                    }`}
                                  >
                                    <MessageCircle size={13} />
                                    <span>{fr.cedSeances.btnEnvoyerWhatsapp}</span>
                                  </button>
                                  {!hasValidTel && (
                                    <p className="text-[11px] font-medium text-amber-800">
                                      {fr.cedSeances.whatsappMissingReason}
                                    </p>
                                  )}
                                  {hasValidTel && res.whatsappOuvertLe && (
                                    <p className="text-[11px] font-medium text-emerald-700 inline-flex items-center gap-1">
                                      <MessageCircle size={11} className="shrink-0" />
                                      <span>
                                        {fr.cedSeances.whatsappOpenedOn}{' '}
                                        {formatDateJJMMAAAA(res.whatsappOuvertLe)}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
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
