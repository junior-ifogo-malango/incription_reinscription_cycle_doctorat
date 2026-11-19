import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, AlertCircle, FileText, Award, MessageCircle, Mail, Upload, FileCheck, XCircle, AlertTriangle, Eye, ChevronDown, Loader2, RefreshCw, Printer, Camera } from 'lucide-react';
import { PV, Notification, Resultat, Compte } from '../types';
import { getConnectedDirecteurId, getDirectorStructure, enrichirPVLecture, getComptes, formatDateJJMM, INITIAL_ENSEIGNANTS } from '../data/mockData';
import { storageService } from '../services/storage';
import { fr } from '../i18n/fr';
import { logEvent, logScanPvConsulte, logScanPvRefuse, logStructureScanDepose } from '../utils/journal';
import { sendAdmissionEmail } from '../emailConfig';
import {
  normaliserTel,
  lienWhatsApp,
  ouvrirLien,
  trouverCandidat,
  notifierDirecteurScanRefuse,
} from '../utils/messages';
import { PVDocument } from './PVDocument';
import { CameraCapture } from './CameraCapture';


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
  const [scanOpenedMap, setScanOpenedMap] = useState<Record<string, boolean>>({});
  const [showScanReplaceMap, setShowScanReplaceMap] = useState<Record<string, boolean>>({});
  const [activePdfView, setActivePdfView] = useState<{
    pv: PV;
    candidatId?: string;
    autoPrint?: boolean;
    directeurNom: string;
  } | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{ pvId: string; refPv: string } | null>(null);
  const structureFileInputsRef = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [scanModalPv, setScanModalPv] = useState<{
    pv: PV;
    refPv: string;
    candidatNom: string;
    candidatId: string;
  } | null>(null);
  const [refusModalTarget, setRefusModalTarget] = useState<{ pvId: string; refPv: string } | null>(null);
  const [refusMotif, setRefusMotif] = useState('');
  const [refusError, setRefusError] = useState<string | null>(null);
  const [sendingEmailMap, setSendingEmailMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!scanModalPv && !refusModalTarget && !activePdfView && !cameraTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cameraTarget) setCameraTarget(null);
        else if (scanModalPv) setScanModalPv(null);
        else if (refusModalTarget) setRefusModalTarget(null);
        else if (activePdfView) setActivePdfView(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanModalPv, refusModalTarget, activePdfView, cameraTarget]);

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
        const cleaned = parsed.map((p) => ({
          ...p,
          resultats: (p.resultats || []).filter(
            (r) => r.candidatId !== 'cand-salma' && r.candidatId !== 'cand-khadija'
          ),
        }));
        // Ignore les versions remplacées et enrichit à la lecture sans modifier les données
        setPvs(cleaned.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
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

  const getDirecteurNom = (pv: PV): string => {
    if (pv.envoyePar && pv.envoyePar.trim()) return pv.envoyePar.trim();
    const ens = INITIAL_ENSEIGNANTS.find((e) => e.id === pv.directeurId);
    if (ens?.nom) return ens.nom;
    const cpt = getComptes().find((c) => c.enseignantId === pv.directeurId || c.id === pv.directeurId);
    if (cpt?.nom) return cpt.nom;
    return 'Directeur de thèse';
  };

  const handleOpenScan = (
    pv: PV,
    pvKey: string,
    refPv: string,
    candidatNom: string,
    candidatId: string
  ) => {
    setScanOpenedMap((prev) => ({ ...prev, [pvKey]: true }));
    setScanModalPv({ pv, refPv, candidatNom, candidatId });
    logScanPvConsulte(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      refPv,
      candidatNom
    );
  };

  const handleOpenPdf = (
    pv: PV,
    pvKey: string,
    refPv: string,
    candidatNom: string,
    candidatId: string,
    autoPrint = false
  ) => {
    setScanOpenedMap((prev) => ({ ...prev, [pvKey]: true }));
    setActivePdfView({
      pv,
      candidatId,
      autoPrint,
      directeurNom: getDirecteurNom(pv),
    });
    logScanPvConsulte(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      refPv,
      candidatNom
    );
  };

  const handleToggleStructureSignature = (pvId: string, checked: boolean) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      const curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        curPvs[idx].structureSignatureAttestee = checked;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
      }
    } catch {}
  };

  const saveStructureScan = (
    pvId: string,
    refPv: string,
    dataUrl?: string,
    fileName?: string
  ) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      const curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        const nowIso = new Date().toISOString();
        curPvs[idx].structureSignatureAttestee = true;
        curPvs[idx].structureScanDeposeLe = nowIso;
        if (dataUrl) {
          curPvs[idx].structureScanDataUrl = dataUrl;
        }
        if (fileName) {
          curPvs[idx].structureScanNom = fileName;
        }
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
        setShowScanReplaceMap((prev) => ({ ...prev, [pvId]: false }));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logStructureScanDepose(
          { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
          refPv,
          fileName || 'Scan validé sans fichier'
        );
        setMessage({ type: 'success', text: fr.cedSeances.structureScanDeposeToast });
        setTimeout(() => setMessage(null), 3500);
      }
    } catch {}
  };

  const handleStructureScanFile = (pvId: string, refPv: string, file?: File | null) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setMessage({ type: 'error', text: fr.cedSeances.fichierTropLourd });
      setTimeout(() => setMessage(null), 3500);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      saveStructureScan(pvId, refPv, dataUrl, file.name);
    };
    reader.readAsDataURL(file);
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

  const handleRefuserScan = (
    pvId: string,
    motif: string = 'Scan illisible ou signatures incomplètes',
    refPvOverride?: string
  ) => {
    const curPv = pvs.find((p) => p.id === pvId);
    if (connectedDirecteurId && curPv?.directeurId === connectedDirecteurId) {
      setMessage({ type: 'error', text: fr.cedSeances.conflitDirecteur });
      return;
    }
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      const curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        const target = curPvs[idx];
        const refPv = refPvOverride || `PV-${target.date}-${(target.code || '').slice(0, 4)}`;
        // Règle : le PV repasse à 'a_signer'
        target.statut = 'a_signer';
        target.scanStatut = 'refuse';
        target.scanMotifRefus = motif;
        delete target.envoyeLe;
        delete target.envoyePar;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logScanPvRefuse(
          { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
          refPv,
          motif
        );
        notifierDirecteurScanRefuse(target.directeurId || 'ens-1', refPv, target.date, motif);
        setMessage({ type: 'error', text: `Scan du PV refusé : ${motif}. Le PV repasse à À signer.` });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch {}
  };

  const handleOpenRefusModal = (pvId: string, refPv: string) => {
    setRefusModalTarget({ pvId, refPv });
    setRefusMotif('');
    setRefusError(null);
  };

  const handleConfirmRefus = () => {
    if (!refusModalTarget) return;
    const cleanMotif = (refusMotif || '').trim();
    if (cleanMotif.length < 5) {
      setRefusError(fr.cedSeances.motifRefusMinError);
      return;
    }
    handleRefuserScan(refusModalTarget.pvId, cleanMotif, refusModalTarget.refPv);
    setRefusModalTarget(null);
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

  const formatDecision = (res?: string): { label: string; className: string; kind: 'admis' | 'attente' | 'refuse' | 'autre' } => {
    if (res === 'ADMIS') {
      return { label: fr.cedSeances.decisionAdmis, className: 'bg-emerald-50 text-emerald-800 border-emerald-200', kind: 'admis' };
    }
    if (res === 'LISTE_COMPLEMENTAIRE') {
      return { label: fr.cedSeances.decisionListeAttente, className: 'bg-amber-50 text-amber-800 border-amber-200', kind: 'attente' };
    }
    if (res === 'REFUSE') {
      return { label: fr.cedSeances.decisionRefuse, className: 'bg-rose-50 text-rose-800 border-rose-200', kind: 'refuse' };
    }
    return { label: res || fr.cedSeances.nonRenseigne, className: 'bg-slate-50 text-slate-700 border-slate-200', kind: 'autre' };
  };

  const renderDecisionPill = (res?: string) => {
    const dec = formatDecision(res);
    return (
      <span className={`inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold border ${dec.className}`}>
        {dec.kind === 'admis' ? (
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
        ) : dec.kind === 'attente' ? (
          <Clock size={13} className="text-amber-600 shrink-0" />
        ) : dec.kind === 'refuse' ? (
          <XCircle size={13} className="text-rose-600 shrink-0" />
        ) : (
          <AlertCircle size={13} className="text-slate-500 shrink-0" />
        )}
        <span>{dec.label}</span>
      </span>
    );
  };

  const renderEtapeBadge = (pv: PV, isPublished: boolean) => {
    if (isPublished) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
          <span>
            {pv.publieLe ? `${fr.cedSeances.publishedOn} ${formatDateJJMMAAAA(pv.publieLe)}` : fr.cedSeances.etapePublie}
          </span>
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

  if (activePdfView) {
    return (
      <PVDocument
        pv={activePdfView.pv}
        directeurNom={activePdfView.directeurNom}
        candidatId={activePdfView.candidatId}
        onClose={() => setActivePdfView(null)}
        autoPrint={activePdfView.autoPrint}
      />
    );
  }

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



      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

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

                {/* Au clic : liste des PV (un par candidat) avec Voir le scan, Conforme, Publier et Refuser le scan */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {fr.cedSeances.pvListHeader.replace('{count}', String(nbCandidats))}
                      </div>
                      {pv.resultats.map((res, i) => {
                        const candidatNom = getCandidatNomComplet(res.candidatId);
                        const baseCode = (pv.code || '').slice(0, 4);
                        const refPv = `PV-${pv.date}-${baseCode}-${i + 1}`;
                        const pvKey = `${pv.id}:${res.candidatId}`;
                        const isScanOpened = Boolean(scanOpenedMap[pvKey]);
                        const isConforme = Boolean(conformiteMap[pvKey]);
                        const hasStructureSignature = Boolean(pv.structureSignatureAttestee);
                        const hasStructureScan = Boolean(pv.structureScanDeposeLe);
                        const canPublish =
                          !isDirecteurOfPv &&
                          isScanOpened &&
                          isConforme &&
                          hasStructureSignature &&
                          hasStructureScan;
                        const isAdmis = res.resultat === 'ADMIS';
                        const candidatInfo = trouverCandidat(res.candidatId);
                        const hasValidTel = Boolean(candidatInfo.tel && normaliserTel(candidatInfo.tel));
                        const waUrl = isAdmis
                          ? lienWhatsApp(candidatInfo.tel, fr.cedSeances.messageAdmission)
                          : null;
                        const isSendingEmail = Boolean(sendingEmailMap[`${pv.id}:${res.candidatId}`]);

                        return (
                          <div
                            key={pvKey}
                            className="p-3.5 flex flex-col gap-3 hover:bg-slate-50/60 transition-colors"
                          >
                            {/* En-tête du PV candidat : nom complet, référence PV-AAAA-MM-JJ-CODE-N, décision (texte + icône) */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="text-xs sm:text-sm font-bold text-slate-900">{candidatNom}</p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  {fr.cedSeances.pvRefPrefix} {refPv}
                                </p>
                                {isPublished && (
                                  <p className="text-[11px] text-slate-500 font-mono">
                                    {candidatInfo.tel || fr.messages.missingPhone} • {candidatInfo.email || fr.messages.missingEmail}
                                  </p>
                                )}
                              </div>

                              {renderDecisionPill(res.resultat)}
                            </div>

                            {/* Actions par PV : Voir le scan, Voir/Télécharger PDF, Conforme, Signature & Scan Structure, Publier, Refuser */}
                            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenScan(pv, pvKey, refPv, candidatNom, res.candidatId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition cursor-pointer min-h-[40px]"
                                  >
                                    <Eye size={15} />
                                    <span>{fr.cedSeances.btnVoirScan}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenPdf(pv, pvKey, refPv, candidatNom, res.candidatId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer min-h-[40px]"
                                  >
                                    <Printer size={15} />
                                    <span>{fr.cedSeances.btnVoirPdf}</span>
                                  </button>

                                  {!isPublished && (
                                    <button
                                      type="button"
                                      disabled={isDirecteurOfPv}
                                      onClick={() => !isDirecteurOfPv && handleOpenRefusModal(pv.id, refPv)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[40px] ${
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

                                {isPublished ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                    <span>
                                      {fr.cedSeances.publishedOn} {formatDateJJMMAAAA(pv.publieLe)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start sm:items-end gap-1">
                                    <button
                                      type="button"
                                      disabled={!canPublish}
                                      onClick={() => canPublish && handlePublier(pv.id)}
                                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                        !canPublish
                                          ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                          : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98 shadow-xs'
                                      }`}
                                    >
                                      <Send size={14} />
                                      <span>{fr.cedSeances.btnPublierCourt}</span>
                                    </button>
                                    {isDirecteurOfPv ? (
                                      <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 text-left sm:text-right max-w-xs">
                                        <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                                        <span>{fr.cedSeances.conflitDirecteur}</span>
                                      </p>
                                    ) : !canPublish ? (
                                      <p className="text-[11px] font-medium text-amber-800 text-left sm:text-right max-w-xs">
                                        {fr.cedSeances.publierStructureDisabledHint}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </div>

                              {!isPublished && (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-fit">
                                      <input
                                        type="checkbox"
                                        checked={isConforme}
                                        onChange={(e) =>
                                          setConformiteMap((prev) => ({ ...prev, [pvKey]: e.target.checked }))
                                        }
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span>{fr.cedSeances.conformeCheckLabel}</span>
                                    </label>

                                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-fit">
                                      <input
                                        type="checkbox"
                                        checked={hasStructureSignature}
                                        onChange={(e) => handleToggleStructureSignature(pv.id, e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <span>{fr.cedSeances.structureSignatureCheckLabel}</span>
                                    </label>
                                  </div>

                                  {hasStructureScan && !showScanReplaceMap[pv.id] ? (
                                    <div className="flex items-center justify-between gap-2 flex-wrap bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
                                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                                        <FileCheck size={14} className="text-emerald-600 shrink-0" />
                                        <span>{fr.cedSeances.structureScanDeposeBadge}</span>
                                        {pv.structureScanNom && (
                                          <span className="text-[11px] font-mono text-emerald-700">
                                            ({pv.structureScanNom})
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowScanReplaceMap((prev) => ({ ...prev, [pv.id]: true }))
                                        }
                                        className="text-[11px] font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                                      >
                                        {fr.cedSeances.structureScanRemplacer}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap bg-indigo-50/60 border border-indigo-200 rounded-xl p-2.5">
                                      <button
                                        type="button"
                                        disabled={isDirecteurOfPv}
                                        onClick={() => !isDirecteurOfPv && setCameraTarget({ pvId: pv.id, refPv })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition cursor-pointer"
                                      >
                                        <Camera size={14} />
                                        <span>{fr.cedSeances.btnScannerPvStructure}</span>
                                      </button>

                                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer">
                                        <Upload size={14} />
                                        <span>{fr.cedSeances.btnImporterScanStructure}</span>
                                        <input
                                          ref={(el) => {
                                            structureFileInputsRef.current[pv.id] = el;
                                          }}
                                          type="file"
                                          accept=".pdf,image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            handleStructureScanFile(pv.id, refPv, e.target.files?.[0]);
                                            e.target.value = '';
                                          }}
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        disabled={isDirecteurOfPv}
                                        onClick={() => !isDirecteurOfPv && saveStructureScan(pv.id, refPv)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg transition cursor-pointer"
                                      >
                                        <FileCheck size={14} />
                                        <span>{fr.cedSeances.btnValiderScanStructureSansDoc}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setScanModalPv(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-emerald-700" />
                  <span>{fr.cedSeances.scanModalTitle.replace('{ref}', scanModalPv.refPv)}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {scanModalPv.candidatNom} • {scanModalPv.pv.structure || structureName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanModalPv(null)}
                aria-label={fr.cedSeances.scanModalFermer}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-semibold text-slate-700">
                  Séance du : {formatDateJJMMAAAA(scanModalPv.pv.date)}
                </span>
                <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                  Scan signé officiel
                </span>
              </div>

              {scanModalPv.pv.resultats.length > 1 && (
                <p className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  {fr.cedSeances.scanModalUniqueNotice}
                </p>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-2">Candidat</th>
                      <th className="p-2 text-center">Note</th>
                      <th className="p-2 text-center">Décision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scanModalPv.pv.resultats.map((r, i) => {
                      const isCurrent = r.candidatId === scanModalPv.candidatId;
                      return (
                        <tr key={i} className={isCurrent ? 'bg-sky-50/70' : ''}>
                          <td className="p-2 font-medium text-slate-800">
                            {getCandidatNomComplet(r.candidatId)}
                          </td>
                          <td className="p-2 text-center font-bold text-emerald-800">{r.note} / 20</td>
                          <td className="p-2 text-center font-bold text-slate-700">
                            {formatDecision(r.resultat).label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-white border border-dashed border-slate-300 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  <FileCheck size={20} className="text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">Paraphes et signatures de la commission validés</p>
                    <p className="text-[11px] text-slate-500">
                      Déposé par le directeur le{' '}
                      {scanModalPv.pv.scanDeposeLe
                        ? formatDate(scanModalPv.pv.scanDeposeLe)
                        : formatDateJJMMAAAA(scanModalPv.pv.date)}
                    </p>
                  </div>
                </div>
                {scanModalPv.pv.scanDataUrl?.startsWith('data:image/') && (
                  <img
                    src={scanModalPv.pv.scanDataUrl}
                    alt={scanModalPv.refPv}
                    className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-slate-50"
                  />
                )}
              </div>

              {scanModalPv.pv.structureScanDeposeLe && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      {fr.cedSeances.structureScanDeposeBadge} le{' '}
                      {formatDate(scanModalPv.pv.structureScanDeposeLe)}
                    </span>
                  </div>
                  {scanModalPv.pv.structureScanDataUrl?.startsWith('data:image/') && (
                    <img
                      src={scanModalPv.pv.structureScanDataUrl}
                      alt={scanModalPv.refPv}
                      className="w-full max-h-64 object-contain rounded-lg border border-emerald-200 bg-white"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const current = scanModalPv;
                  setScanModalPv(null);
                  setActivePdfView({
                    pv: current.pv,
                    candidatId: current.candidatId,
                    directeurNom: getDirecteurNom(current.pv),
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer"
              >
                <Printer size={14} />
                <span>{fr.cedSeances.btnVoirPdf}</span>
              </button>
              <button
                type="button"
                onClick={() => setScanModalPv(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                {fr.cedSeances.scanModalFermer}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Refus du scan avec motif obligatoire */}
      {refusModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRefusModalTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <XCircle size={16} className="text-rose-600" />
                <span>{fr.cedSeances.modalRefusTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRefusModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] font-mono text-slate-500">{refusModalTarget.refPv}</p>

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
                onClick={() => setRefusModalTarget(null)}
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

      {cameraTarget && (
        <CameraCapture
          title={fr.cedSeances.cameraScanTitre}
          autoOcrOnCapture
          onCapture={(dataUrl) => {
            saveStructureScan(cameraTarget.pvId, cameraTarget.refPv, dataUrl, 'scan-pv-structure.jpg');
            setCameraTarget(null);
          }}
          onErrorFallback={() => {
            const target = cameraTarget;
            setCameraTarget(null);
            if (target) {
              structureFileInputsRef.current[target.pvId]?.click();
            }
          }}
          onClose={() => setCameraTarget(null)}
        />
      )}

    </div>
  );
};
