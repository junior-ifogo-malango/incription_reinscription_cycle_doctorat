import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Award,
  MessageCircle,
  Mail,
  FileCheck,
  XCircle,
  AlertTriangle,
  Eye,
  ChevronDown,
  Loader2,
  Camera,
  Download,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { PV, Notification, Resultat, getCompteRoles } from '../types';
import { getConnectedDirecteurId, getDirectorStructure, enrichirPVLecture, getComptes, formatDateJJMM, isSalmaOrAlamiRecord } from '../data/mockData';
import { storageService } from '../services/storage';
import { fr } from '../i18n/fr';
import { logEvent, logPvConsulte } from '../utils/journal';
import { sendAdmissionEmail } from '../emailConfig';
import { auth, db } from '../firebase';
import { syncPvBestEffort } from '../utils/firebaseSync';
import { CameraCapture } from './CameraCapture';
import { PVDocument } from './PVDocument';
import {
  normaliserTel,
  lienWhatsApp,
  ouvrirLien,
  trouverCandidat,
} from '../utils/messages';

const ADMIN_EMAILS = new Set(['ifogojunior168@gmail.com', 'nature.hostil@gmail.com']);
const MAX_PV_SCAN_BYTES = 1.5 * 1024 * 1024;

function isPdfData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:application/pdf') || data.toLowerCase().endsWith('.pdf');
}

function isImageData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return (
    data.startsWith('data:image/') ||
    data.startsWith('/assets/') ||
    data.startsWith('blob:') ||
    /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(data)
  );
}

function openPdfInNewTab(dataUrl: string): void {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch {}
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {}
}

function broadcastPvsUpdated(): void {
  window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('usmba_pvs_channel');
      ch.postMessage({ type: 'usmba_pvs_updated', at: Date.now() });
      ch.close();
    }
  } catch {}
}


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
    broadcastPvsUpdated();
    void syncPvBestEffort();
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
  const [scanModalPv, setScanModalPv] = useState<PV | null>(null);
  const [scanModalCandidatId, setScanModalCandidatId] = useState<string | null>(null);
  const [scanTab, setScanTab] = useState<'directeur' | 'structure'>('directeur');
  const [openedPvIds, setOpenedPvIds] = useState<Record<string, boolean>>({});
  const [activeDocPv, setActiveDocPv] = useState<{ pv: PV; candidatId?: string; autoPrint?: boolean } | null>(null);
  const [scanCameraPvId, setScanCameraPvId] = useState<string | null>(null);
  const [refusModalPvId, setRefusModalPvId] = useState<string | null>(null);
  const [refusMotif, setRefusMotif] = useState('');
  const [refusError, setRefusError] = useState<string | null>(null);
  const [sendingEmailMap, setSendingEmailMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scanModalPv) {
          setScanModalPv(null);
          setScanModalCandidatId(null);
        } else if (refusModalPvId) {
          setRefusModalPvId(null);
        } else if (scanCameraPvId) {
          setScanCameraPvId(null);
        } else if (activeDocPv) {
          setActiveDocPv(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanModalPv, refusModalPvId, scanCameraPvId, activeDocPv]);

  const getConnectedAccountInfo = (): { isMainCed: boolean; structureName: string } => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const acc = JSON.parse(raw);
        if (acc) {
          const emailLower = (acc.email || '').trim().toLowerCase();
          const isMain =
            acc.id === 'ced' ||
            emailLower === 'directeurstructure@gmail.com' ||
            emailLower === 'ced@demo.ma' ||
            !acc.structure ||
            acc.structure === 'CED USMBA' ||
            acc.structure === 'USMBA Fès';
          if (emailLower === 'ced@demo.ma') {
            return { isMainCed: true, structureName: 'LISAC - FSDM Fès' };
          }
          if (acc.structure && acc.structure !== 'CED USMBA' && acc.structure !== 'USMBA Fès') {
            return { isMainCed: isMain, structureName: acc.structure.trim() };
          }
          return { isMainCed: isMain, structureName: 'LISAC - FSDM Fès' };
        }
      }
      const allComptes = getComptes();
      const cedCompte = allComptes.find(
        (c) => c.id === 'ced' || c.email === 'directeurstructure@gmail.com' || c.email === 'ced@demo.ma'
      );
      if (cedCompte?.structure) {
        return { isMainCed: true, structureName: cedCompte.structure };
      }
    } catch {}
    return { isMainCed: true, structureName: 'LISAC - FSDM Fès' };
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

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('usmba_pvs_channel');
        channel.onmessage = () => loadData();
      }
    } catch {}

    // Synchronisation optionnelle depuis Firestore si l'utilisateur est authentifié
    const pullFirestorePvs = async () => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return;
      try {
        const userEmail = (user.email || '').trim().toLowerCase();
        const isAdminUser = ADMIN_EMAILS.has(userEmail);
        const pvsRef = collection(db, 'pvs');
        const q = isAdminUser ? pvsRef : query(pvsRef, where('ownerUid', '==', user.uid));
        const snap = await getDocs(q);
        if (snap.empty) return;

        const rawLocal = localStorage.getItem('usmba_doctorat_pvs');
        const localList: PV[] = rawLocal ? JSON.parse(rawLocal) : [];
        const byId = new Map<string, PV>(localList.map((p) => [p.id, p]));
        const rank: Record<string, number> = {
          a_signer: 1,
          signe: 2,
          envoye: 3,
          original_recu: 4,
          approuve: 4,
          publie: 5,
        };
        let changed = false;

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const remoteId = String(d.id || docSnap.id);
          const remoteStatut = String(d.statut || 'a_signer') as PV['statut'];
          const existing = byId.get(remoteId);
          const remoteResults: Resultat[] = Array.isArray(d.resultats)
            ? d.resultats
                .filter((r: { candidatId?: string }) => !isSalmaOrAlamiRecord({ id: r?.candidatId }))
                .map((r: { candidatId?: string; note?: number; resultat?: string }) => {
                  const localMatch = existing?.resultats?.find((lr) => lr.candidatId === r.candidatId);
                  return {
                    creneauId: localMatch?.creneauId || '',
                    candidatId: String(r.candidatId || ''),
                    note: Number(r.note ?? localMatch?.note ?? 0),
                    resultat: (r.resultat || localMatch?.resultat || 'ADMIS') as Resultat['resultat'],
                    saisiLe: localMatch?.saisiLe || String(d.envoyeLe || d.date || new Date().toISOString()),
                    emailStatut: localMatch?.emailStatut,
                    emailErreur: localMatch?.emailErreur,
                    emailEnvoyeLe: localMatch?.emailEnvoyeLe,
                    whatsappOuvertLe: localMatch?.whatsappOuvertLe,
                  };
                })
            : existing?.resultats || [];

          if (!existing) {
            byId.set(remoteId, {
              id: remoteId,
              directeurId: String(d.directeurId || 'ens-1'),
              structure: String(d.structure || 'LISAC - FSDM Fès'),
              date: String(d.date || new Date().toISOString().slice(0, 10)),
              resultats: remoteResults,
              statut: remoteStatut,
              code: typeof d.code === 'string' ? d.code : '',
              genereLe: typeof d.genereLe === 'string' ? d.genereLe : String(d.envoyeLe || d.date || new Date().toISOString()),
              scanStatut: d.scanStatut as PV['scanStatut'],
              scanDeposeLe: typeof d.scanDeposeLe === 'string' ? d.scanDeposeLe : undefined,
              envoyeLe: typeof d.envoyeLe === 'string' ? d.envoyeLe : undefined,
              envoyePar: typeof d.envoyePar === 'string' ? d.envoyePar : undefined,
              publieLe: typeof d.publieLe === 'string' ? d.publieLe : undefined,
              signaturesCount: typeof d.signaturesCount === 'number' ? d.signaturesCount : undefined,
              membres: Array.isArray(d.membres) && d.membres.length >= 2
                ? [String(d.membres[0] || ''), String(d.membres[1] || '')]
                : undefined,
            });
            changed = true;
          } else if ((rank[remoteStatut] || 0) > (rank[existing.statut] || 0)) {
            byId.set(remoteId, {
              ...existing,
              statut: remoteStatut,
              structure: existing.structure || String(d.structure || ''),
              envoyeLe: existing.envoyeLe || (typeof d.envoyeLe === 'string' ? d.envoyeLe : undefined),
              envoyePar: existing.envoyePar || (typeof d.envoyePar === 'string' ? d.envoyePar : undefined),
              publieLe: existing.publieLe || (typeof d.publieLe === 'string' ? d.publieLe : undefined),
              scanDeposeLe: existing.scanDeposeLe || (typeof d.scanDeposeLe === 'string' ? d.scanDeposeLe : undefined),
              scanStatut: existing.scanStatut || (d.scanStatut as PV['scanStatut']),
            });
            changed = true;
          }
        });

        if (changed) {
          const merged = Array.from(byId.values());
          localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(merged));
          loadData();
        }
      } catch {
        // Ignorer silencieusement si hors ligne ou règles non applicables
      }
    };
    void pullFirestorePvs();

    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_account_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (channel) channel.close();
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
      broadcastPvsUpdated();
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
    if (!openedPvIds[pvId]) {
      setMessage({ type: 'error', text: fr.cedSeances.publierScanRequisRaison });
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
        broadcastPvsUpdated();
        void syncPvBestEffort();
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

  const getDirecteurNomForPv = (pv: PV): string => {
    if (pv.envoyePar?.trim()) return pv.envoyePar.trim();
    try {
      const comptes = getComptes();
      const match = comptes.find((c) => c.id === pv.directeurId);
      if (match?.nom) return match.nom;
    } catch {}
    return 'Directeur de thèse';
  };

  const markPvOpenedAndLog = (pv: PV, candidatId?: string) => {
    setOpenedPvIds((prev) => ({ ...prev, [pv.id]: true }));
    const baseCode = (pv.code || 'CODE').slice(0, 4);
    if (candidatId) {
      const idx = (pv.resultats || []).findIndex((r) => r.candidatId === candidatId);
      const num = idx >= 0 ? idx + 1 : 1;
      const refCandidat = `PV-${pv.date}-${baseCode}-${num}`;
      logPvConsulte(
        { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
        refCandidat,
        getCandidatNomComplet(candidatId)
      );
      return;
    }
    const refSeance = `PV-${pv.date}-${baseCode}`;
    const detail = pv.scanStructureFichier
      ? 'Scan Structure'
      : pv.scanFichier
      ? 'Document déposé'
      : 'PV généré';
    logPvConsulte(
      { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
      refSeance,
      detail
    );
  };

  const handleOpenScanModal = (pv: PV) => {
    setScanModalCandidatId(null);
    setScanModalPv(pv);
    setScanTab(pv.scanStructureFichier && !pv.scanFichier ? 'structure' : 'directeur');
    markPvOpenedAndLog(pv);
  };

  const handleOpenCandidatePV = (pv: PV, candidatId: string) => {
    setScanModalCandidatId(candidatId);
    setScanModalPv(pv);
    markPvOpenedAndLog(pv, candidatId);
  };

  const handleCloseScanModal = () => {
    setScanModalPv(null);
    setScanModalCandidatId(null);
  };

  const handleDownloadAllPvsForSession = (pv: PV) => {
    setActiveDocPv({ pv, autoPrint: true });
  };

  const handleDownloadCandidatePV = (pv: PV, candidatId: string) => {
    setActiveDocPv({ pv, candidatId, autoPrint: true });
  };

  const saveStructureScanToPv = (pvId: string, dataUrl: string, fileName: string) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      const curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx === -1) return;
      const nowIso = new Date().toISOString();
      curPvs[idx].scanStructureFichier = dataUrl;
      curPvs[idx].scanStructureNomFichier = fileName;
      curPvs[idx].scanStructureDeposeLe = nowIso;
      localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
      const enrichedList = curPvs.filter((p) => !p.remplaceePar).map(enrichirPVLecture);
      setPvs(enrichedList);
      const updatedTarget = enrichedList.find((p) => p.id === pvId);
      if (updatedTarget && scanModalPv?.id === pvId) {
        setScanModalPv(updatedTarget);
        setScanTab('structure');
      }
      broadcastPvsUpdated();
      void syncPvBestEffort();
      logEvent(
        { id: 'dir-ced', nom: 'Directeur de structure', role: 'directeur_ced' },
        fr.journalActions.scanPvDepose,
        `PV-${curPvs[idx].date}-${(curPvs[idx].code || '').slice(0, 4)}`,
        `Scan contresigné par la Structure (${fileName})`
      );
      setMessage({ type: 'success', text: fr.cedSeances.scanStructureDeposeToast });
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ type: 'error', text: 'Stockage plein, impossible d’enregistrer le scan signé.' });
    }
  };

  const handleStructureFileChange = (pvId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(lowerName);
    if (!isPdf && !isImg) {
      setMessage({ type: 'error', text: fr.cedSeances.scanFichierTypeInvalide });
      return;
    }
    if (file.size > MAX_PV_SCAN_BYTES) {
      setMessage({ type: 'error', text: fr.cedSeances.scanFichierTropGrand });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveStructureScanToPv(pvId, reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
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

  const { isMainCed, structureName } = getConnectedAccountInfo();
  const normalizedStructureName = structureName.trim().toLowerCase();
  const dedicatedCedStructures = new Set(
    getComptes()
      .filter(
        (c) =>
          c.id !== 'ced' &&
          c.statut === 'actif' &&
          getCompteRoles(c).includes('structure') &&
          c.structure?.trim()
      )
      .map((c) => c.structure!.trim().toLowerCase())
  );

  const pvsStructure = pvs.filter((pv) => {
    if (pv.remplaceePar) return false;
    // Déterminer la structure à la lecture (avec repli sur la structure principale)
    const pvStructure = (pv.structure || getDirectorStructure(pv.directeurId) || 'LISAC - FSDM Fès').trim();
    const normPvStruct = pvStructure.toLowerCase();
    const matchesOwnStructure = normPvStruct === normalizedStructureName;
    const isCoveredByMainCed = isMainCed && !dedicatedCedStructures.has(normPvStruct);
    if (!matchesOwnStructure && !isCoveredByMainCed) return false;

    // Statut 'envoye' (ou 'publie'/refusé déjà traités)
    const isEnvoye = pv.statut === 'envoye';
    const isPublie = pv.statut === 'publie' || Boolean(pv.publieLe);
    const isRefuse = pv.scanStatut === 'refuse';
    const isLegacyTraite = pv.statut === 'original_recu' || pv.statut === 'approuve';

    return isEnvoye || isPublie || isRefuse || isLegacyTraite;
  });

  if (activeDocPv) {
    return (
      <PVDocument
        pv={activeDocPv.pv}
        directeurNom={getDirecteurNomForPv(activeDocPv.pv)}
        candidatId={activeDocPv.candidatId}
        onClose={() => setActiveDocPv(null)}
        autoPrint={activeDocPv.autoPrint}
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
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            OK
          </button>
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

                {/* Au clic : volet avec Voir le scan, Refuser le scan, case de conformité, Publier (grisé avec raison écrite) et la liste des candidats */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
                    {/* Barre d'actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Voir le PV / scan */}
                        <button
                          type="button"
                          onClick={() => handleOpenScanModal(pv)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition cursor-pointer min-h-[44px]"
                        >
                          <Eye size={15} />
                          <span>{fr.cedSeances.btnVoirScan}</span>
                        </button>

                        {/* Bouton groupé unique : Tout télécharger */}
                        <button
                          type="button"
                          onClick={() => handleDownloadAllPvsForSession(pv)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer min-h-[44px]"
                        >
                          <Download size={15} />
                          <span>{fr.cedSeances.btnToutTelecharger}</span>
                        </button>

                        {/* Scanner */}
                        <button
                          type="button"
                          onClick={() => setScanCameraPvId(pv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition cursor-pointer min-h-[44px]"
                        >
                          <Camera size={15} />
                          <span>{fr.cedSeances.btnScanner}</span>
                        </button>

                        {/* Importer */}
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer min-h-[44px]">
                          <Upload size={15} />
                          <span>{fr.cedSeances.btnImporter}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) => handleStructureFileChange(pv.id, e)}
                          />
                        </label>

                        {pv.scanStructureFichier && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <FileCheck size={13} className="text-emerald-600 shrink-0" />
                            <span>{fr.cedSeances.scanStructureBadge}</span>
                          </span>
                        )}

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

                      {/* Publier les résultats (grisé tant que le PV n'a pas été ouvert) */}
                      {isPublished ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span>
                            {fr.cedSeances.publishedOn} {formatDate(pv.publieLe)}
                          </span>
                        </div>
                      ) : (() => {
                        const hasOpenedDoc = Boolean(openedPvIds[pv.id]);
                        const isPublishDisabled = isDirecteurOfPv || !hasOpenedDoc;
                        const disabledReason = isDirecteurOfPv
                          ? fr.cedSeances.conflitDirecteur
                          : !hasOpenedDoc
                          ? fr.cedSeances.publierScanRequisRaison
                          : null;

                        return (
                          <div className="flex flex-col items-start sm:items-end gap-1">
                            <button
                              type="button"
                              disabled={isPublishDisabled}
                              onClick={() => !isPublishDisabled && handlePublier(pv.id)}
                              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                isPublishDisabled
                                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98 shadow-xs'
                              }`}
                            >
                              <Send size={15} />
                              <span>{fr.cedSeances.btnPublier}</span>
                            </button>
                            {disabledReason && (
                              <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1 text-left sm:text-right max-w-xs">
                                <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                                <span>{disabledReason}</span>
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>

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
                              <button
                                type="button"
                                onClick={() => handleOpenCandidatePV(pv, res.candidatId)}
                                className="text-xs font-bold text-slate-900 hover:text-emerald-800 hover:underline text-left cursor-pointer"
                              >
                                {candidatNom}
                              </button>

                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${dec.className}`}>
                                  {dec.label}
                                </span>

                                <button
                                  type="button"
                                  aria-label={fr.cedSeances.voirPvCandidatAria.replace('{nom}', candidatNom)}
                                  onClick={() => handleOpenCandidatePV(pv, res.candidatId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition cursor-pointer"
                                >
                                  <Eye size={13} />
                                  <span>{fr.cedSeances.btnVoirCandidatPV}</span>
                                </button>

                                <button
                                  type="button"
                                  aria-label={fr.cedSeances.telechargerPvCandidatAria.replace('{nom}', candidatNom)}
                                  onClick={() => handleDownloadCandidatePV(pv, res.candidatId)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 rounded-lg transition cursor-pointer"
                                >
                                  <Download size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Actions réelles d'admission réservées uniquement aux candidats « Favorable » (ADMIS) */}
                            {isPublished && isAdmis && (
                              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100">
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
                                  <button
                                    type="button"
                                    title={res.emailErreur || fr.cedSeances.emailNetworkError}
                                    onClick={() => sendRealEmailForCandidate(pv.id, res)}
                                    className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer active:scale-98 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <Mail size={13} />
                                    <span>{fr.cedSeances.btnRenvoyerEmail}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={!hasValidTel || !waUrl}
                                  title={!hasValidTel ? fr.cedSeances.whatsappMissingReason : undefined}
                                  onClick={() =>
                                    hasValidTel && waUrl && handleOpenWhatsAppAdmission(pv.id, res, waUrl)
                                  }
                                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                                    hasValidTel && waUrl
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-98'
                                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                  }`}
                                >
                                  <MessageCircle size={13} />
                                  <span>{fr.cedSeances.btnEnvoyerWhatsapp}</span>
                                </button>
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

      {/* Modal : Affichage réel du document (PDF / scan image déposé, ou PV généré) */}
      {scanModalPv && (() => {
        const baseCode = (scanModalPv.code || 'CODE').slice(0, 4);
        const candIdx = scanModalCandidatId
          ? (scanModalPv.resultats || []).findIndex((r) => r.candidatId === scanModalCandidatId)
          : -1;
        const candRef = scanModalCandidatId
          ? `PV-${scanModalPv.date}-${baseCode}-${(candIdx >= 0 ? candIdx : 0) + 1}`
          : null;
        const hasDirectorFile = Boolean(scanModalPv.scanFichier);
        const hasStructureFile = Boolean(scanModalPv.scanStructureFichier);
        const activeFile =
          scanTab === 'structure' && scanModalPv.scanStructureFichier
            ? scanModalPv.scanStructureFichier
            : scanModalPv.scanFichier || scanModalPv.scanStructureFichier;
        const activeFileName =
          scanTab === 'structure' && scanModalPv.scanStructureFichier
            ? scanModalPv.scanStructureNomFichier || `pv-structure-${scanModalPv.date}`
            : scanModalPv.scanNomFichier ||
              scanModalPv.scanStructureNomFichier ||
              `PV-${scanModalPv.date}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-5 shadow-2xl space-y-3 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 shrink-0">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-700" />
                    <span>
                      {scanModalCandidatId
                        ? `${getCandidatNomComplet(scanModalCandidatId)} · ${candRef}`
                        : `PV — Séance du ${formatDateJJMM(scanModalPv.date)}`}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {scanModalPv.structure || structureName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseScanModal}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {fr.cedSeances.btnFermer}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {scanModalCandidatId ? (
                  <PVDocument
                    pv={scanModalPv}
                    directeurNom={getDirecteurNomForPv(scanModalPv)}
                    candidatId={scanModalCandidatId}
                    onClose={handleCloseScanModal}
                  />
                ) : activeFile ? (
                  <>
                    {hasDirectorFile && hasStructureFile && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setScanTab('directeur')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            scanTab === 'directeur'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {fr.cedSeances.ongletScanDirecteur}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScanTab('structure')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            scanTab === 'structure'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {fr.cedSeances.ongletScanStructure}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-semibold text-slate-800">{activeFileName}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPdfData(activeFile) && (
                          <button
                            type="button"
                            onClick={() => openPdfInNewTab(activeFile)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            <span>{fr.cedSeances.ouvrirPdfNouvelOnglet}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            downloadDataUrl(
                              activeFile,
                              activeFileName.includes('.')
                                ? activeFileName
                                : `${activeFileName}.${isPdfData(activeFile) ? 'pdf' : 'jpg'}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                        >
                          <Download size={13} />
                          <span>{fr.cedSeances.btnTelechargerFichier}</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-100 rounded-xl overflow-y-auto max-h-[65vh] border border-slate-200 flex justify-center">
                      {isPdfData(activeFile) ? (
                        <iframe
                          src={activeFile}
                          title={activeFileName}
                          className="w-full h-[65vh] border-0"
                        />
                      ) : isImageData(activeFile) ? (
                        <img
                          src={activeFile}
                          alt={activeFileName}
                          className="max-w-full h-auto object-contain mx-auto"
                        />
                      ) : (
                        <p className="text-xs text-slate-500 p-6">Aperçu indisponible pour ce fichier.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                      {fr.cedSeances.aucunDocumentDepose}
                    </p>
                    <PVDocument
                      pv={scanModalPv}
                      directeurNom={getDirecteurNomForPv(scanModalPv)}
                      onClose={handleCloseScanModal}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseScanModal}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
                >
                  {fr.cedSeances.btnFermer}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Caméra pour scanner le PV avec la signature de la Structure */}
      {scanCameraPvId && (
        <CameraCapture
          title={fr.cedSeances.scanStructureCameraTitre}
          onCapture={(dataUrl) => {
            const targetPv = pvs.find((p) => p.id === scanCameraPvId);
            const fileName = `pv-structure-signe-${targetPv?.date || 'seance'}.jpg`;
            saveStructureScanToPv(scanCameraPvId, dataUrl, fileName);
            setScanCameraPvId(null);
          }}
          onClose={() => setScanCameraPvId(null)}
        />
      )}

    </div>
  );
};
