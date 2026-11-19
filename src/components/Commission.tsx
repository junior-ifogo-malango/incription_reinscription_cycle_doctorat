import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Circle,
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
  Printer,
  Upload,
  Send,
  AlertTriangle,
  FileCheck,
  CloudUpload,
  Loader2,
} from 'lucide-react';
import { Creneau, Resultat, ResultatType, PV, Candidat, calculerNoteResultat, StatutSeance, SeanceStatutRecord } from '../types';
import {
  MOCK_CANDIDATS,
  INITIAL_CRENEAUX,
  getDirectorStructure,
  enrichirPVLecture,
  getComptes,
  calculerStatutSeance,
  getSeancesStatutsMap,
  saveSeanceStatut,
  aujourdhui,
} from '../data/mockData';
import { PVDocument } from './PVDocument';
import { fr } from '../i18n/fr';
import { logEvent, logPresenceConstatee, logAbsenceConstatee } from '../utils/journal';
import { ajouterNotification, messageAbsenceConstatee, trouverCandidat } from '../utils/messages';
import { syncDepositedToFirestore, syncPvBestEffort } from '../utils/firebaseSync';

interface CommissionProps {
  enseignantId: string;
  enseignantNom: string;
}

function formatJJMM(dateStr?: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
  }
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function formatJJMMAAAA(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [yyyy, mm, dd] = clean.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return clean;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isInterviewReached(dateStr?: string, heureStr?: string, demoDateOverride?: string): boolean {
  const targetDate = (dateStr || '').trim();
  if (!targetDate) return false;
  const refDate = (demoDateOverride || aujourdhui()).trim();
  if (refDate > targetDate) return true;
  if (refDate < targetDate) return false;
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const targetHeure = (heureStr || '00:00').trim();
  return nowHHMM >= targetHeure;
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
  const [seancesStatuts, setSeancesStatuts] = useState<Record<string, SeanceStatutRecord>>({});
  const [activePV, setActivePV] = useState<{ pv: PV; candidatId?: string; autoPrint?: boolean } | null>(null);
  const [pvDownloaded, setPvDownloaded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('usmba_commission_pv_downloaded');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Noms des 2 membres de commission par séance
  const [seanceMembres, setSeanceMembres] = useState<Record<string, [string, string]>>(() => {
    try {
      const raw = localStorage.getItem('usmba_commission_seance_membres');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleMembreChange = (date: string, index: 0 | 1, value: string) => {
    setSeanceMembres((prev) => {
      const cur = prev[date] || ['', ''];
      const updated: [string, string] = [
        index === 0 ? value : cur[0],
        index === 1 ? value : cur[1],
      ];
      const next = { ...prev, [date]: updated };
      try {
        localStorage.setItem('usmba_commission_seance_membres', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Formulaire d'évaluation en cours par créneau : 4 critères /5 + avis motivé
  const [editForms, setEditForms] = useState<
    Record<
      string,
      {
        acquis: string;
        projet: string;
        methodo: string;
        oral: string;
        resultat: ResultatType;
        avis: string;
        error?: string;
      }
    >
  >({});
  const [openForms, setOpenForms] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const [reopenModalDate, setReopenModalDate] = useState<string | null>(null);
  const [reopenMotif, setReopenMotif] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Modal Signaler un empêchement
  const [empechementModalDate, setEmpechementModalDate] = useState<string | null>(null);
  const [empechementMotif, setEmpechementMotif] = useState('');
  const [empechementError, setEmpechementError] = useState<string | null>(null);

  // Constatation de présence / absence par candidat
  const [demoDateStr, setDemoDateStr] = useState<string>(() => aujourdhui());
  const [absentTargetCreneauId, setAbsentTargetCreneauId] = useState<string | null>(null);
  const [absentMotif, setAbsentMotif] = useState('');
  const [absentError, setAbsentError] = useState<string | null>(null);

  // Validation des 3 signatures papier par PV & synchronisation Firebase
  const [signaturesChecks, setSignaturesChecks] = useState<Record<string, [boolean, boolean, boolean]>>({});
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Chargement des données avec persistance localStorage et try/catch
  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pvs_updated', handleSync);
    window.addEventListener('usmba_seances_updated', handleSync);
    window.addEventListener('usmba_creneaux_updated', handleSync);
    window.addEventListener('usmba_demo_date_updated', handleSync);
    window.addEventListener('storage', handleSync);
    const timer = window.setInterval(() => {
      setDemoDateStr(aujourdhui());
    }, 30000);
    return () => {
      window.removeEventListener('usmba_pvs_updated', handleSync);
      window.removeEventListener('usmba_seances_updated', handleSync);
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_demo_date_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.clearInterval(timer);
    };
  }, [enseignantId]);

  const loadData = () => {
    setDemoDateStr(aujourdhui());
    setSeancesStatuts(getSeancesStatutsMap());
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
        const parsed: PV[] = JSON.parse(rawPvs);
        setPvs(parsed.map(enrichirPVLecture));
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
    const found = trouverCandidat(candidatId);
    if (found.nom) return found.nom;
    const c = getCandidat(candidatId);
    return c?.nom || candidatId;
  };

  // Filtrer les créneaux convoqués (y compris convocation reçue / présent / absent) de cet enseignant
  const creneauxConvoques = creneaux.filter(
    (c) =>
      Boolean(c.candidatId) &&
      (c.statut === 'reserve' || c.statut === 'confirme' || c.statut === 'absent')
  );

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

  // Validation et calcul automatique de la note globale sur 20 à partir des 4 critères /5
  const getFormValidation = (form?: {
    acquis: string;
    projet: string;
    methodo: string;
    oral: string;
    resultat: ResultatType;
    avis: string;
  }) => {
    if (!form) return { isValid: false, reason: fr.commission.criteresInvalidesReason, total: null };

    const parseVal = (v?: string) => {
      if (!v) return null;
      const trimmed = v.trim().replace(',', '.');
      if (trimmed === '') return null;
      const num = parseFloat(trimmed);
      return !isNaN(num) && num >= 0 && num <= 5 ? num : null;
    };

    const nAcquis = parseVal(form.acquis);
    const nProjet = parseVal(form.projet);
    const nMethodo = parseVal(form.methodo);
    const nOral = parseVal(form.oral);

    if (nAcquis === null || nProjet === null || nMethodo === null || nOral === null) {
      return { isValid: false, reason: fr.commission.criteresInvalidesReason, total: null };
    }

    const total = Math.round((nAcquis + nProjet + nMethodo + nOral) * 10) / 10;

    // Avis motivé obligatoire (5 caractères min.) si Défavorable (REFUSE)
    if (form.resultat === 'REFUSE') {
      const cleanAvis = (form.avis || '').trim();
      if (cleanAvis.length < 5) {
        return { isValid: false, reason: fr.commission.avisMotiveRequiredReason, total };
      }
    }

    return {
      isValid: true,
      reason: '',
      total,
      values: { acquis: nAcquis, projet: nProjet, methodo: nMethodo, oral: nOral },
    };
  };

  // Initialiser ou mettre à jour le formulaire d'évaluation pour un créneau
  const initFormForCreneau = (c: Creneau) => {
    const existing = getResultatForCreneau(c.id);
    setEditForms((prev) => ({
      ...prev,
      [c.id]: {
        acquis: existing?.criteres?.acquis !== undefined ? String(existing.criteres.acquis) : '',
        projet: existing?.criteres?.projet !== undefined ? String(existing.criteres.projet) : '',
        methodo: existing?.criteres?.methodo !== undefined ? String(existing.criteres.methodo) : '',
        oral: existing?.criteres?.oral !== undefined ? String(existing.criteres.oral) : '',
        resultat: existing ? existing.resultat : 'ADMIS',
        avis: existing?.avis || existing?.motif || '',
      },
    }));
    setOpenForms((prev) => ({ ...prev, [c.id]: true }));
  };

  const handleFieldChange = (
    creneauId: string,
    field: 'acquis' | 'projet' | 'methodo' | 'oral' | 'resultat' | 'avis',
    value: string
  ) => {
    setEditForms((prev) => {
      const cur = prev[creneauId] || {
        acquis: '',
        projet: '',
        methodo: '',
        oral: '',
        resultat: 'ADMIS',
        avis: '',
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
    const validation = getFormValidation(form);

    if (!validation.isValid || !validation.values || validation.total === null) {
      setEditForms((prev) => ({
        ...prev,
        [creneau.id]: {
          ...(form || {
            acquis: '',
            projet: '',
            methodo: '',
            oral: '',
            resultat: 'ADMIS',
            avis: '',
          }),
          error: validation.reason,
        },
      }));
      return;
    }

    // Sauvegarde du résultat avec note calculée (somme des 4 critères) et avis
    const nouveauResultat: Resultat = {
      creneauId: creneau.id,
      candidatId: creneau.candidatId || '',
      note: validation.total,
      resultat: form.resultat,
      motif: form.resultat === 'REFUSE' ? form.avis.trim() : undefined,
      avis: form.avis.trim() || undefined,
      criteres: validation.values,
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

      // Fermer le formulaire pour ce candidat
      setOpenForms((prev) => ({ ...prev, [creneau.id]: false }));
      setFeedback({ id: creneau.id, text: fr.commission.resultSaved });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setEditForms((prev) => ({
        ...prev,
        [creneau.id]: {
          ...form,
          error: 'Erreur de stockage localStorage.',
        },
      }));
    }
  };

  const handleMarquerPresent = (c: Creneau) => {
    if (!isInterviewReached(c.date, c.heure, demoDateStr)) return;
    const nowIso = new Date().toISOString();
    try {
      const raw = localStorage.getItem('usmba_doctorat_creneaux');
      const allC: Creneau[] = raw ? JSON.parse(raw) : creneaux;
      const updated = allC.map((item) =>
        item.id === c.id
          ? {
              ...item,
              presence: 'present' as const,
              absenceMotif: undefined,
              presenceConstateeLe: nowIso,
            }
          : item
      );
      localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify(updated));
      setCreneaux(updated.filter((item) => item.enseignantId === enseignantId));
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      const candNom = getCandidatNom(c.candidatId);
      logPresenceConstatee(
        { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
        candNom,
        `${formatJJMMAAAA(c.date)} à ${c.heure}`
      );
      setAbsentTargetCreneauId(null);
      setAbsentMotif('');
      setAbsentError(null);
      setFeedback({ id: `pres-${c.id}`, text: fr.commission.toastPresenceConstatee });
      setTimeout(() => setFeedback(null), 3500);
    } catch {}
  };

  const handleOpenAbsent = (c: Creneau) => {
    if (!isInterviewReached(c.date, c.heure, demoDateStr)) return;
    setAbsentTargetCreneauId(c.id);
    setAbsentMotif('');
    setAbsentError(null);
  };

  const handleConfirmAbsent = (c: Creneau) => {
    if (!isInterviewReached(c.date, c.heure, demoDateStr)) return;
    const cleanMotif = absentMotif.trim();
    if (cleanMotif.length < 5) {
      setAbsentError(fr.commission.absenceMotifError);
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      const raw = localStorage.getItem('usmba_doctorat_creneaux');
      const allC: Creneau[] = raw ? JSON.parse(raw) : creneaux;
      const updated = allC.map((item) =>
        item.id === c.id
          ? {
              ...item,
              statut: 'absent' as const,
              presence: 'absent' as const,
              absenceMotif: cleanMotif,
              presenceConstateeLe: nowIso,
            }
          : item
      );
      localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify(updated));
      setCreneaux(updated.filter((item) => item.enseignantId === enseignantId));
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      // S'assurer qu'aucun résultat n'est conservé pour un candidat absent
      try {
        const rawRes = localStorage.getItem('usmba_doctorat_resultats');
        if (rawRes) {
          const curRes: Resultat[] = JSON.parse(rawRes);
          const nextRes = curRes.filter((r) => r.creneauId !== c.id);
          if (nextRes.length !== curRes.length) {
            localStorage.setItem('usmba_doctorat_resultats', JSON.stringify(nextRes));
            setResultats(nextRes);
          }
        }
      } catch {}

      if (c.candidatId) {
        ajouterNotification({
          destinataireId: c.candidatId,
          texte: messageAbsenceConstatee(c.date, c.heure, cleanMotif),
          type: 'action',
          actionLabel: fr.notifications.btnAllerEntretiens,
          actionTab: 'entretiens',
        });
      }

      const candNom = getCandidatNom(c.candidatId);
      logAbsenceConstatee(
        { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
        candNom,
        `${formatJJMMAAAA(c.date)} à ${c.heure}`,
        cleanMotif
      );

      setAbsentTargetCreneauId(null);
      setAbsentMotif('');
      setAbsentError(null);
      setFeedback({ id: `abs-${c.id}`, text: fr.commission.toastAbsenceConstatee });
      setTimeout(() => setFeedback(null), 3500);
    } catch {}
  };

  // Regroupement par date pour la section Séances
  const allTeacherDates = new Set<string>();
  creneauxConvoques.forEach((c) => {
    allTeacherDates.add(c.date);
  });
  pvs.forEach((p) => {
    if (p.directeurId === enseignantId) {
      allTeacherDates.add(p.date);
    }
  });
  Object.keys(seancesStatuts).forEach((key) => {
    if (key.startsWith(`${enseignantId}_`)) {
      const d = key.slice(`${enseignantId}_`.length);
      allTeacherDates.add(d);
    }
  });

  const seancesParDate = Array.from(allTeacherDates).reduce((acc, d) => {
    acc[d] = creneauxConvoques.filter((c) => c.date === d);
    return acc;
  }, {} as Record<string, Creneau[]>);

  const datesSeances = Array.from(allTeacherDates).sort();

  // Génération ou régénération d'une nouvelle version de PV (uniquement les candidats constatés présents)
  const handleGeneratePV = (date: string, creneauxDate: Creneau[]) => {
    const existing = getLatestPVForDate(date);
    if (existing && !existing.rouvertLe) {
      setActivePV({ pv: existing });
      return;
    }

    const presentCreneauxDate = creneauxDate.filter((c) => c.presence === 'present');
    if (presentCreneauxDate.length === 0) return;

    // Vérifier que tous les candidats présents ont un résultat
    const resultatsDate = presentCreneauxDate.map((c) => getResultatForCreneau(c.id));
    const allHaveResult = resultatsDate.every((r) => r !== undefined);
    if (!allHaveResult) return;

    // Copie figée des résultats
    const frozenResults: Resultat[] = resultatsDate as Resultat[];
    const newCode = generatePVCode();
    const nowIso = new Date().toISOString();

    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];

      const dirStructure = getDirectorStructure(enseignantId);

      const dateMembres = seanceMembres[date] || existing?.membres || ['', ''];
      const membresTuple: [string, string] = [dateMembres[0] || '', dateMembres[1] || ''];

      let coordonnateurNom: string | undefined = undefined;
      try {
        const comptes = getComptes();
        const matching = comptes.find(
          (c) =>
            (c.role === 'directeur_ced' || c.roles?.includes('structure')) &&
            c.structure &&
            dirStructure &&
            (c.structure.toLowerCase().includes(dirStructure.toLowerCase()) ||
              dirStructure.toLowerCase().includes(c.structure.toLowerCase())) &&
            c.nom &&
            !c.nom.toLowerCase().includes('direction')
        );
        if (matching?.nom) {
          coordonnateurNom = matching.nom;
        } else {
          const fallbackCed = comptes.find(
            (c) =>
              (c.role === 'directeur_ced' || c.roles?.includes('structure')) &&
              c.nom &&
              !c.nom.toLowerCase().includes('direction')
          );
          if (fallbackCed?.nom) coordonnateurNom = fallbackCed.nom;
        }
      } catch {}

      if (existing && existing.rouvertLe) {
        // Régénération après réouverture : version = ancienne version + 1
        const nextVersion = (existing.version ?? 1) + 1;
        const newId = `pv-${Date.now()}`;
        existing.remplaceePar = newId;

        const newPV: PV = {
          id: newId,
          directeurId: enseignantId,
          structure: dirStructure,
          date,
          resultats: frozenResults,
          statut: 'a_signer',
          code: newCode,
          genereLe: nowIso,
          version: nextVersion,
          membres: membresTuple,
          coordonnateur: coordonnateurNom,
        };

        const idx = curPvs.findIndex((p) => p.id === existing.id);
        if (idx !== -1) {
          curPvs[idx] = existing;
        }
        curPvs.push(newPV);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        setActivePV({ pv: newPV });
      } else {
        // Première version
        const newPV: PV = {
          id: `pv-${Date.now()}`,
          directeurId: enseignantId,
          structure: dirStructure,
          date,
          resultats: frozenResults,
          statut: 'a_signer',
          code: newCode,
          genereLe: nowIso,
          version: 1,
          membres: membresTuple,
          coordonnateur: coordonnateurNom,
        };
        curPvs.push(newPV);
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        setActivePV({ pv: newPV });
      }
      logEvent({ id: enseignantId, nom: enseignantNom, role: 'enseignant' }, fr.journalActions.pvGenere, `PV séance du ${date} (Code ${newCode})`);
    } catch {}
  };

  const handleDownloadPV = (pv: PV) => {
    setPvDownloaded((prev) => {
      const next = { ...prev, [pv.date]: true, [pv.id]: true };
      try {
        localStorage.setItem('usmba_commission_pv_downloaded', JSON.stringify(next));
      } catch {}
      return next;
    });
    setActivePV({ pv, autoPrint: true });
  };

  const handleDeposerScanCommission = (pvId: string) => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        const nowIso = new Date().toISOString();
        curPvs[idx].statut = 'signe';
        curPvs[idx].scanDeposeLe = nowIso;
        curPvs[idx].scanStatut = 'valide';
        curPvs[idx].signaturesCount = 3;
        delete curPvs[idx].scanMotifRefus;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logEvent(
          { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
          fr.journalActions.scanPvDepose,
          `PV-${curPvs[idx].date}-${(curPvs[idx].code || '').slice(0, 4)}`,
          'Scan signé déposé par le directeur'
        );
        setFeedback({ id: pvId, text: fr.commission.scanDeposeToast });
        setTimeout(() => setFeedback(null), 3000);
        void syncPvBestEffort();
      }
    } catch {}
  };

  const handleEnvoyerStructure = (pvId: string) => {
    const confirmed = window.confirm(fr.commission.confirmEnvoyerStructure);
    if (!confirmed) return;

    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      let curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        const nowIso = new Date().toISOString();
        curPvs[idx].statut = 'envoye';
        curPvs[idx].envoyeLe = nowIso;
        curPvs[idx].envoyePar = enseignantNom;
        curPvs[idx].signaturesCount = 3;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvs(curPvs.map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logEvent(
          { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
          fr.journalActions.pvEnvoye,
          `PV-${curPvs[idx].date}-${(curPvs[idx].code || '').slice(0, 4)}`,
          `Transmis à la structure (${curPvs[idx].structure || ''})`
        );
        setFeedback({ id: pvId, text: fr.commission.pvEnvoyeToast });
        setTimeout(() => setFeedback(null), 3000);
        void syncPvBestEffort();
      }
    } catch {}
  };

  const getSignatureChecks = (pvId: string): [boolean, boolean, boolean] =>
    signaturesChecks[pvId] || [true, true, true];

  const handleToggleSignatureCheck = (pvId: string, index: 0 | 1 | 2) => {
    setSignaturesChecks((prev) => {
      const cur = prev[pvId] || [true, true, true];
      const next: [boolean, boolean, boolean] = [
        index === 0 ? !cur[0] : cur[0],
        index === 1 ? !cur[1] : cur[1],
        index === 2 ? !cur[2] : cur[2],
      ];
      return { ...prev, [pvId]: next };
    });
  };

  const handleValider3SignaturesEtDeposer = (pvId: string) => {
    const checks = getSignatureChecks(pvId);
    if (!checks[0] || !checks[1] || !checks[2]) return;

    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      const curPvs: PV[] = raw ? JSON.parse(raw) : [];
      const idx = curPvs.findIndex((p) => p.id === pvId);
      if (idx !== -1) {
        const nowIso = new Date().toISOString();
        const pv = curPvs[idx];
        pv.statut = 'envoye';
        pv.signaturesCount = 3;
        pv.scanDeposeLe = pv.scanDeposeLe || nowIso;
        pv.scanStatut = 'valide';
        pv.envoyeLe = nowIso;
        pv.envoyePar = enseignantNom;
        delete pv.scanMotifRefus;
        localStorage.setItem('usmba_doctorat_pvs', JSON.stringify(curPvs));
        setPvDownloaded((prev) => {
          const next = { ...prev, [pv.date]: true, [pv.id]: true };
          try {
            localStorage.setItem('usmba_commission_pv_downloaded', JSON.stringify(next));
          } catch {}
          return next;
        });
        setPvs(curPvs.map(enrichirPVLecture));
        window.dispatchEvent(new CustomEvent('usmba_pvs_updated'));
        logEvent(
          { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
          fr.journalActions.scanPvDepose,
          `PV-${pv.date}-${(pv.code || '').slice(0, 4)}`,
          '3 signatures validées et scan déposé'
        );
        logEvent(
          { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
          fr.journalActions.pvEnvoye,
          `PV-${pv.date}-${(pv.code || '').slice(0, 4)}`,
          `Déposé chez le Directeur de structure (${pv.structure || ''})`
        );
        setFeedback({ id: pvId, text: fr.commission.signatures3DeposeToast });
        setTimeout(() => setFeedback(null), 4000);
        void syncPvBestEffort();
      }
    } catch {}
  };

  const handleSyncFirebaseClick = async () => {
    setSyncingFirebase(true);
    setSyncFeedback(null);
    try {
      const summary = await syncDepositedToFirestore({ promptGoogleLoginIfNeeded: true });
      const msg = fr.commission.syncFirebaseSucces
        .replace('{cands}', String(summary.candidaturesSynced))
        .replace('{pvs}', String(summary.pvsSynced))
        .replace('{suppr}', String(summary.removedSalmaAlami));
      setSyncFeedback({ type: 'success', text: msg });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err || '');
      const lower = rawMsg.toLowerCase();
      if (
        rawMsg.includes('AUTH_REQUIRED') ||
        lower.includes('popup-closed-by-user') ||
        lower.includes('cancelled-popup-request')
      ) {
        setSyncFeedback({ type: 'error', text: fr.commission.syncFirebaseAuthCancelled });
      } else if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
        setSyncFeedback({ type: 'error', text: fr.commission.syncFirebaseRulesError });
      } else {
        setSyncFeedback({ type: 'error', text: rawMsg || fr.commission.syncFirebaseRulesError });
      }
    } finally {
      setSyncingFirebase(false);
    }
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

  // Signalement d'un empêchement avec motif obligatoire (5 caractères min.)
  const handleConfirmEmpechement = (date: string) => {
    const cleanMotif = (empechementMotif || '').trim();
    if (cleanMotif.length < 5) {
      setEmpechementError(fr.commission.modalEmpechementMotifError);
      return;
    }

    const seanceKey = `${enseignantId}_${date}`;
    const nowIso = new Date().toISOString();

    // 1. Sauvegarder statut reportee
    saveSeanceStatut(seanceKey, {
      statutManuel: 'reportee',
      motif: cleanMotif,
      declarePar: enseignantNom,
      declareLe: nowIso,
    });
    setSeancesStatuts((prev) => ({
      ...prev,
      [seanceKey]: {
        statutManuel: 'reportee',
        motif: cleanMotif,
        declarePar: enseignantNom,
        declareLe: nowIso,
      },
    }));

    // 2. Notifier les candidats de la séance
    const touchedCandidates = new Set<string>();
    const sessionCreneaux = creneaux.filter((c) => c.date === date);
    sessionCreneaux.forEach((c) => {
      if (c.candidatId && !touchedCandidates.has(c.candidatId)) {
        touchedCandidates.add(c.candidatId);
        ajouterNotification({
          destinataireId: c.candidatId,
          texte: fr.commission.notifSeanceReportee
            .replace('{date}', formatJJMM(date))
            .replace('{motif}', cleanMotif),
          type: 'action',
        });
      }
    });

    // 3. Rouvrir les créneaux
    try {
      const raw = localStorage.getItem('usmba_doctorat_creneaux');
      let allC: Creneau[] = raw ? JSON.parse(raw) : [];
      allC = allC.map((c) => {
        if (c.enseignantId === enseignantId && c.date === date) {
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
      localStorage.setItem('usmba_doctorat_creneaux', JSON.stringify(allC));
      setCreneaux(allC.filter((c) => c.enseignantId === enseignantId));
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
    } catch {}

    // 4. logEvent
    logEvent(
      { id: enseignantId, nom: enseignantNom, role: 'enseignant' },
      fr.journalActions.seanceReportee,
      `Séance du ${formatJJMM(date)}`,
      cleanMotif
    );

    // 5. Toast feedback
    setFeedback({ id: `emp-${date}`, text: fr.commission.toastEmpechementSuccess });
    setTimeout(() => setFeedback(null), 3000);

    setEmpechementModalDate(null);
    setEmpechementMotif('');
    setEmpechementError(null);
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

  // Si affichage plein écran du PVDocument (pour un candidat ou pour toute la séance)
  if (activePV) {
    return (
      <PVDocument
        pv={activePV.pv}
        directeurNom={enseignantNom}
        candidatId={activePV.candidatId}
        onClose={() => setActivePV(null)}
        autoPrint={activePV.autoPrint}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <button
            type="button"
            onClick={handleSyncFirebaseClick}
            disabled={syncingFirebase}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            {syncingFirebase ? (
              <Loader2 size={14} className="animate-spin shrink-0" />
            ) : (
              <CloudUpload size={14} className="shrink-0" />
            )}
            <span>
              {syncingFirebase ? fr.commission.syncFirebaseEnCours : fr.commission.btnSyncFirebase}
            </span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{syncFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Toast de feedback */}
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Cas d'erreur : aucune séance */}
      {datesSeances.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">{fr.commission.aucunEntretienConvoque}</h3>
            <p className="text-xs text-slate-500">{fr.commission.aucunEntretienConvoqueDesc}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {datesSeances.map((date) => {
            const creneauxDate = seancesParDate[date] || [];
            const presentCreneauxDate = creneauxDate.filter((c) => c.presence === 'present');
            const existingPV = getLatestPVForDate(date);
            const seanceKey = `${enseignantId}_${date}`;
            const sessionPvs = pvs.filter((p) => p.date === date && p.directeurId === enseignantId);
            const statutRecord = seancesStatuts[seanceKey];
            const statutInfo = calculerStatutSeance(date, enseignantId, sessionPvs, statutRecord);
            const isReportee = statutInfo.statut === 'reportee';
            const isNonTenue = statutInfo.statut === 'non_tenue';

            const totalCount = creneauxDate.length;
            const presentCount = presentCreneauxDate.length;
            const evaluatedCount = presentCreneauxDate.filter((c) => Boolean(getResultatForCreneau(c.id))).length;
            const allEvaluated = presentCount > 0 && evaluatedCount === presentCount;
            const isDownloaded = Boolean(existingPV && (pvDownloaded[existingPV.id] || pvDownloaded[date] || existingPV.scanDeposeLe));
            const isScanDepose = Boolean(
              existingPV &&
                (existingPV.statut === 'signe' ||
                  existingPV.statut === 'envoye' ||
                  existingPV.statut === 'publie' ||
                  existingPV.scanDeposeLe) &&
                existingPV.scanStatut !== 'refuse'
            );
            const isEnvoye = Boolean(
              existingPV && (existingPV.statut === 'envoye' || existingPV.statut === 'publie' || existingPV.publieLe)
            );
            const lieu = creneauxDate[0]?.lieu || 'CED';

            // Suivi en 4 étapes
            const step1Done = allEvaluated;
            const step1Current = !allEvaluated;

            const step2Done = Boolean(existingPV && !existingPV.rouvertLe);
            const step2Current = !step2Done && step1Done;
            const step2Upcoming = !step2Done && !step1Done;

            const step3Done = isScanDepose;
            const step3Current = !step3Done && step2Done;
            const step3Upcoming = !step3Done && !step2Done;

            const step4Done = isEnvoye;
            const step4Current = !step4Done && step3Done;
            const step4Upcoming = !step4Done && !step3Done;

            const steps = [
              {
                id: 1,
                label: `Notes (${evaluatedCount}/${presentCount})`,
                done: step1Done,
                current: step1Current,
                upcoming: false,
              },
              {
                id: 2,
                label: 'PV généré',
                done: step2Done,
                current: step2Current,
                upcoming: step2Upcoming,
              },
              {
                id: 3,
                label: 'Scan déposé',
                done: step3Done,
                current: step3Current,
                upcoming: step3Upcoming,
              },
              {
                id: 4,
                label: 'Envoyé à la Structure',
                done: step4Done,
                current: step4Current,
                upcoming: step4Upcoming,
              },
            ];

            return (
              <div
                key={date}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition"
              >
                {/* 1. En-tête : "Séance du JJ/MM · lieu" + pastille d'état */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Séance du {formatJJMM(date)} · {lieu}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {totalCount} {totalCount > 1 ? fr.commission.totalEntretiens : 'entretien'}
                      </p>
                    </div>
                  </div>

                  {/* Pastille d'état & Signaler un empêchement */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isReportee ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock size={13} className="text-amber-700 shrink-0" />
                        <span>{fr.commission.seanceBadgeReportee}</span>
                      </span>
                    ) : isNonTenue ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                        <XCircle size={13} className="text-rose-600 shrink-0" />
                        <span>{fr.commission.seanceBadgeNonTenue}</span>
                      </span>
                    ) : isEnvoye ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-300">
                        <Send size={13} className="text-sky-600 shrink-0" />
                        <span>{existingPV?.statut === 'publie' ? 'Publié' : 'Envoyé à la Structure'}</span>
                      </span>
                    ) : isScanDepose ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
                        <FileCheck size={13} className="text-indigo-600 shrink-0" />
                        <span>Scan déposé</span>
                      </span>
                    ) : existingPV?.scanStatut === 'refuse' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                        <XCircle size={13} className="text-rose-600 shrink-0" />
                        <span>Scan refusé</span>
                      </span>
                    ) : existingPV?.rouvertLe ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <RotateCcw size={13} className="text-amber-600 shrink-0" />
                        <span>Séance rouverte</span>
                      </span>
                    ) : existingPV ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        <FileSignature size={13} className="text-amber-600 shrink-0" />
                        <span>PV généré (à signer)</span>
                      </span>
                    ) : allEvaluated ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>Notes complètes</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        <Clock size={13} className="text-slate-500 shrink-0" />
                        <span>Évaluation en cours</span>
                      </span>
                    )}

                    {/* Bouton Signaler un empêchement */}
                    {!isReportee && !isNonTenue && !isEnvoye && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmpechementModalDate(date);
                          setEmpechementMotif('');
                          setEmpechementError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition cursor-pointer shadow-2xs"
                      >
                        <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                        <span>{fr.commission.btnSignalerEmpechement}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Suivi en 4 étapes (icône + texte) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1">
                  {steps.map((st) => {
                    if (st.done) {
                      return (
                        <div
                          key={st.id}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900"
                        >
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold leading-tight">{st.label}</span>
                        </div>
                      );
                    }
                    if (st.current) {
                      return (
                        <div
                          key={st.id}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-900"
                        >
                          <Clock size={16} className="text-amber-600 shrink-0" />
                          <span className="text-xs font-bold leading-tight">{st.label}</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={st.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400"
                      >
                        <Circle size={16} className="text-slate-300 shrink-0" />
                        <span className="text-xs font-medium leading-tight">{st.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Exception : séance reportée */}
                {isReportee && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock size={14} className="text-amber-700" />
                      <span>{fr.commission.seanceReporteeNotice}</span>
                    </div>
                    {statutInfo.motif && (
                      <p className="text-[11px] text-amber-800 italic">
                        Motif : « {statutInfo.motif} »
                      </p>
                    )}
                  </div>
                )}

                {/* Exception : séance non tenue */}
                {isNonTenue && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle size={14} className="text-rose-600" />
                      <span>{fr.commission.seanceNonTenueNotice}</span>
                    </div>
                    {statutInfo.motif && (
                      <p className="text-[11px] text-rose-800 italic">
                        Motif : « {statutInfo.motif} »
                      </p>
                    )}
                  </div>
                )}

                {/* Exception : scan refusé */}
                {existingPV?.scanStatut === 'refuse' && existingPV.scanMotifRefus && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle size={14} className="text-rose-600" />
                      <span>Scan refusé par la Structure</span>
                    </div>
                    <p className="text-[11px] text-rose-800 italic">
                      Motif : « {existingPV.scanMotifRefus} ». Déposez un nouveau scan signé.
                    </p>
                  </div>
                )}

                {/* Exception : séance rouverte */}
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

                {/* 3. Candidats de la séance : UNE ligne par candidat sous le suivi */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Candidats de la séance ({totalCount})
                  </h4>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {creneauxDate.map((c) => {
                      const res = getResultatForCreneau(c.id);
                      const candidatNom = getCandidatNom(c.candidatId);
                      const isPresent = c.presence === 'present';
                      const isAbsent = c.statut === 'absent' || c.presence === 'absent';
                      const isConvocationRecue = c.statut === 'confirme';
                      const reached = isInterviewReached(c.date, c.heure, demoDateStr);
                      const disabledReason = !reached
                        ? fr.commission.presenceDisabledReason
                            .replace('{date}', formatJJMMAAAA(c.date))
                            .replace('{heure}', c.heure)
                        : null;
                      const isFormOpen = openForms[c.id] || !res;
                      const isLocked = Boolean(existingPV && !existingPV.rouvertLe);

                      const form = editForms[c.id] || {
                        acquis: res?.criteres?.acquis !== undefined ? String(res.criteres.acquis) : '',
                        projet: res?.criteres?.projet !== undefined ? String(res.criteres.projet) : '',
                        methodo: res?.criteres?.methodo !== undefined ? String(res.criteres.methodo) : '',
                        oral: res?.criteres?.oral !== undefined ? String(res.criteres.oral) : '',
                        resultat: res ? res.resultat : 'ADMIS',
                        avis: res?.avis || res?.motif || '',
                      };

                      const validation = getFormValidation(form);

                      return (
                        <div key={c.id} className="p-3 space-y-3">
                          {/* En-tête du candidat + pastille + boutons Marquer présent / Marquer absent */}
                          {(!isPresent || (isPresent && res && !isFormOpen)) && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900">{candidatNom}</span>
                                <span className="text-[11px] text-slate-400 font-mono">({c.heure})</span>
                                {isPresent ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                    <span>{fr.commission.badgePresent}</span>
                                  </span>
                                ) : isAbsent ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    <XCircle size={12} className="text-rose-600 shrink-0" />
                                    <span>{fr.commission.badgeAbsent}</span>
                                  </span>
                                ) : isConvocationRecue ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                    <span>{fr.commission.badgeConvocationRecue}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock size={12} className="text-amber-600 shrink-0" />
                                    <span>{fr.commission.badgeConvoque}</span>
                                  </span>
                                )}
                              </div>

                              {!isPresent && !isAbsent && (
                                <div className="flex flex-col items-start sm:items-end gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      disabled={!reached}
                                      onClick={() => handleMarquerPresent(c)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        reached
                                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer'
                                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                      }`}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>{fr.commission.btnMarquerPresent}</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!reached}
                                      onClick={() => handleOpenAbsent(c)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        reached
                                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                      }`}
                                    >
                                      <XCircle size={13} />
                                      <span>{fr.commission.btnMarquerAbsent}</span>
                                    </button>
                                  </div>
                                  {disabledReason && (
                                    <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                                      <Clock size={11} className="shrink-0 text-amber-600" />
                                      <span>{disabledReason}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Formulaire inline de motif d'absence (5 car. min., erreur écrite sous le champ) */}
                          {!isPresent && !isAbsent && absentTargetCreneauId === c.id && (
                            <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                                  {fr.commission.absenceMotifLabel}
                                </label>
                                <input
                                  type="text"
                                  value={absentMotif}
                                  onChange={(e) => {
                                    setAbsentMotif(e.target.value);
                                    setAbsentError(null);
                                  }}
                                  placeholder={fr.commission.absenceMotifPlaceholder}
                                  className="w-full text-xs p-2 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                                />
                                {absentError && (
                                  <p className="mt-1 text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                                    <AlertCircle size={12} className="shrink-0" />
                                    <span>{absentError}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAbsentTargetCreneauId(null);
                                    setAbsentMotif('');
                                    setAbsentError(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                                >
                                  {fr.common.cancel}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAbsent(c)}
                                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <XCircle size={13} />
                                  <span>{fr.commission.btnConfirmerAbsence}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {!isPresent && !isAbsent && absentTargetCreneauId !== c.id && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <Lock size={12} className="text-slate-400 shrink-0" />
                              <span>{fr.commission.presenceEnAttenteHint}</span>
                            </p>
                          )}

                          {isAbsent && (
                            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-900 space-y-1">
                              {c.absenceMotif && (
                                <p className="text-[11px] italic">
                                  Motif : « {c.absenceMotif} »
                                </p>
                              )}
                              <p className="text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
                                <AlertCircle size={12} className="shrink-0 text-rose-600" />
                                <span>{fr.commission.absentNoEvalHint}</span>
                              </p>
                            </div>
                          )}

                          {isPresent && res && !isFormOpen ? (
                            /* UNE ligne par candidat : note /20, décision (icône + texte), bouton Voir */
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-slate-100">
                              <div className="text-[11px] text-slate-500 font-medium">
                                Évaluation enregistrée
                              </div>

                              <div className="flex items-center gap-2.5 flex-wrap">
                                {/* Note /20 */}
                                <span className="font-mono font-bold text-xs text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                  {calculerNoteResultat(res).toFixed(1)} / 20
                                </span>

                                {/* Décision (icône + texte) */}
                                {renderStatusBadgeResultat(res.resultat)}

                                {/* Bouton Voir : ouvre PVDocument en page A4 pour ce candidat */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const dateMembres = seanceMembres[date] || existingPV?.membres || ['', ''];
                                    const sessionPV = existingPV || {
                                      id: `pv-${date}`,
                                      directeurId: enseignantId,
                                      structure: getDirectorStructure(enseignantId),
                                      date,
                                      resultats: presentCreneauxDate.map((cr) => getResultatForCreneau(cr.id)).filter(Boolean) as Resultat[],
                                      statut: 'a_signer' as const,
                                      code: generatePVCode(),
                                      genereLe: new Date().toISOString(),
                                      membres: [dateMembres[0] || '', dateMembres[1] || ''] as [string, string],
                                    };
                                    setActivePV({ pv: sessionPV, candidatId: c.candidatId });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                                >
                                  <Eye size={13} />
                                  <span>{fr.commission.btnVoirCandidat}</span>
                                </button>

                                {/* Modifier (si PV non figé) */}
                                {!isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => initFormForCreneau(c)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                                    title={fr.commission.btnEditResult}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : isPresent ? (
                            /* Formulaire d'évaluation par candidat présent : 4 notes /5, total /20 calculé, décision, avis motivé */
                            <div className="pt-1 space-y-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-slate-900">{candidatNom}</span>
                                  <span className="text-[11px] text-slate-400 font-mono">({c.heure})</span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                    <span>{fr.commission.badgePresent}</span>
                                  </span>
                                </div>
                                {res && !isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => setOpenForms((prev) => ({ ...prev, [c.id]: false }))}
                                    className="text-[11px] text-slate-500 hover:text-slate-700"
                                  >
                                    {fr.common.cancel}
                                  </button>
                                )}
                              </div>

                              {/* 4 notes /5 */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    {fr.commission.critereAcquisLabel}
                                  </label>
                                  <p className="text-[10px] text-slate-500 mb-1 leading-tight">
                                    {fr.commission.critereAcquisDesc}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={form.acquis}
                                      onChange={(e) => handleFieldChange(c.id, 'acquis', e.target.value)}
                                      placeholder="0 à 5"
                                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono font-bold">/ 05</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    {fr.commission.critereProjetLabel}
                                  </label>
                                  <p className="text-[10px] text-slate-500 mb-1 leading-tight">
                                    {fr.commission.critereProjetDesc}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={form.projet}
                                      onChange={(e) => handleFieldChange(c.id, 'projet', e.target.value)}
                                      placeholder="0 à 5"
                                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono font-bold">/ 05</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    {fr.commission.critereMethodoLabel}
                                  </label>
                                  <p className="text-[10px] text-slate-500 mb-1 leading-tight">
                                    {fr.commission.critereMethodoDesc}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={form.methodo}
                                      onChange={(e) => handleFieldChange(c.id, 'methodo', e.target.value)}
                                      placeholder="0 à 5"
                                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono font-bold">/ 05</span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                    {fr.commission.critereOralLabel}
                                  </label>
                                  <p className="text-[10px] text-slate-500 mb-1 leading-tight">
                                    {fr.commission.critereOralDesc}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={form.oral}
                                      onChange={(e) => handleFieldChange(c.id, 'oral', e.target.value)}
                                      placeholder="0 à 5"
                                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono focus:ring-1 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs text-slate-500 font-mono font-bold">/ 05</span>
                                  </div>
                                </div>
                              </div>

                              {/* Total calculé /20 et Décision */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-300">
                                  <span className="text-xs font-bold text-slate-700">{fr.commission.totalNoteLabel} :</span>
                                  <span className="font-mono font-black text-sm text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {validation.total !== null ? `${validation.total.toFixed(1)} / 20` : '— / 20'}
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    {fr.commission.decisionLabel} *
                                  </label>
                                  <select
                                    value={form.resultat}
                                    onChange={(e) => handleFieldChange(c.id, 'resultat', e.target.value as ResultatType)}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium focus:ring-1 focus:ring-emerald-500"
                                  >
                                    <option value="ADMIS">{fr.commission.resultats.ADMIS}</option>
                                    <option value="LISTE_COMPLEMENTAIRE">{fr.commission.resultats.LISTE_COMPLEMENTAIRE}</option>
                                    <option value="REFUSE">{fr.commission.resultats.REFUSE}</option>
                                  </select>
                                </div>
                              </div>

                              {/* Avis motivé */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  {fr.commission.avisMotiveLabel}{' '}
                                  {form.resultat === 'REFUSE' ? (
                                    <span className="text-rose-600 font-semibold">* ({fr.commission.avisMotiveRequired})</span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">(facultatif)</span>
                                  )}
                                </label>
                                <textarea
                                  rows={2}
                                  value={form.avis}
                                  onChange={(e) => handleFieldChange(c.id, 'avis', e.target.value)}
                                  placeholder={fr.commission.avisMotivePlaceholder}
                                  className={`w-full text-xs p-2 rounded-lg border bg-white focus:outline-none focus:ring-1 ${
                                    form.resultat === 'REFUSE' && form.avis.trim().length < 5
                                      ? 'border-rose-300 focus:ring-rose-500'
                                      : 'border-slate-300 focus:ring-emerald-500'
                                  }`}
                                />
                              </div>

                              {/* Bouton Enregistrer (grisé avec raison écrite sinon) */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                                {!validation.isValid ? (
                                  <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
                                    <AlertCircle size={13} className="shrink-0 text-rose-600" />
                                    <span>{validation.reason}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                                    <span>{validation.total !== null ? `Note : ${validation.total.toFixed(1)}/20 · Prêt à enregistrer` : 'Prêt à enregistrer'}</span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  disabled={!validation.isValid}
                                  onClick={() => handleSaveResultat(c)}
                                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
                                    validation.isValid
                                      ? 'text-white bg-emerald-700 hover:bg-emerald-800 shadow-xs cursor-pointer'
                                      : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                                  }`}
                                >
                                  {fr.commission.btnSaveResult}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Membres de la commission pour cette séance (modifiables avant génération du PV) */}
                {(() => {
                  const curMembres = seanceMembres[date] || existingPV?.membres || ['', ''];
                  const isMembresLocked = Boolean(existingPV && !existingPV.rouvertLe);

                  return (
                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          {fr.commission.membresSectionTitle}
                        </span>
                        {isMembresLocked && (
                          <span className="text-[11px] text-slate-500 italic">
                            Enregistrés dans le PV
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            {fr.commission.membre1Label}
                          </label>
                          <input
                            type="text"
                            disabled={isMembresLocked}
                            value={curMembres[0] || ''}
                            onChange={(e) => handleMembreChange(date, 0, e.target.value)}
                            placeholder={fr.commission.membre1Placeholder}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border transition ${
                              isMembresLocked
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white text-slate-800 border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            {fr.commission.membre2Label}
                          </label>
                          <input
                            type="text"
                            disabled={isMembresLocked}
                            value={curMembres[1] || ''}
                            onChange={(e) => handleMembreChange(date, 1, e.target.value)}
                            placeholder={fr.commission.membre2Placeholder}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border transition ${
                              isMembresLocked
                                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                : 'bg-white text-slate-800 border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. UN seul bouton d'action selon l'étape */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {isReportee || isNonTenue ? (
                    <div className="text-xs text-slate-600 italic flex items-center gap-2 py-1">
                      <AlertCircle size={14} className="text-slate-400 shrink-0" />
                      <span>{isReportee ? fr.commission.seanceReporteeNotice : fr.commission.seanceNonTenueNotice}</span>
                    </div>
                  ) : !existingPV || existingPV.rouvertLe ? (
                    /* Étape 1 / 2 : Générer le PV (ou Régénérer si rouvert) */
                    !allEvaluated ? (
                      <>
                        <div className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-amber-600 shrink-0" />
                          <span>
                            {presentCount === 0
                              ? fr.commission.noPresentForPvHint
                              : `Notes incomplètes : évaluez les ${presentCount - evaluatedCount} candidat(s) présent(s) restant(s)`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          >
                            <FileSignature size={14} />
                            <span>Générer le PV</span>
                          </button>
                          <div className="flex flex-col items-start sm:items-end gap-0.5">
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              title={fr.commission.genereDabordPV}
                            >
                              <Printer size={13} />
                              <span>{fr.commission.btnTelechargerSeance}</span>
                            </button>
                            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                              <AlertCircle size={11} className="text-slate-400 shrink-0" />
                              <span>{fr.commission.genereDabordPV}</span>
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>Tous les entretiens sont évalués. Prêt pour la génération du PV.</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleGeneratePV(date, creneauxDate)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
                          >
                            <FileSignature size={14} />
                            <span>{existingPV?.rouvertLe ? fr.commission.btnRegeneratePV : 'Générer le PV'}</span>
                          </button>
                          <div className="flex flex-col items-start sm:items-end gap-0.5">
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              title={fr.commission.genereDabordPV}
                            >
                              <Printer size={13} />
                              <span>{fr.commission.btnTelechargerSeance}</span>
                            </button>
                            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                              <AlertCircle size={11} className="text-slate-400 shrink-0" />
                              <span>{fr.commission.genereDabordPV}</span>
                            </span>
                          </div>
                        </div>
                      </>
                    )
                  ) : !isDownloaded ? (
                    /* Étape 2 : Télécharger le PV */
                    <>
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="font-semibold text-slate-800">PV prêt à signer</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[11px] font-mono text-slate-500">Ref {(existingPV.code || '').slice(0, 4)}</span>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadPV(existingPV)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <Printer size={14} />
                          <span>{fr.commission.btnTelechargerSeance}</span>
                        </button>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {fr.commission.indicationPdf}
                        </p>
                      </div>
                    </>
                  ) : !isScanDepose ? (
                    /* Étape 3 : Déposer le scan */
                    <>
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="font-semibold text-slate-800">PV téléchargé</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadPV(existingPV)}
                          className="text-[11px] text-emerald-700 underline hover:text-emerald-800 cursor-pointer"
                        >
                          (Réimprimer la séance)
                        </button>
                      </div>
                      <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer">
                        <Upload size={14} />
                        <span>Déposer le scan</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={() => handleDeposerScanCommission(existingPV.id)}
                        />
                      </label>
                    </>
                  ) : existingPV.statut === 'signe' ? (
                    /* Étape 4 : Envoyer à la Structure (actif) */
                    <>
                      <div className="text-xs text-indigo-900 font-semibold flex items-center gap-1.5">
                        <FileCheck size={14} className="text-indigo-600 shrink-0" />
                        <span>Scan signé déposé · Prêt pour transmission</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEnvoyerStructure(existingPV.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <Send size={14} />
                        <span>Envoyer à la Structure</span>
                      </button>
                    </>
                  ) : (
                    /* Étape 4 : Déjà envoyé (grisé avec raison écrite) */
                    <>
                      <div className="text-xs text-sky-900 font-semibold flex items-center gap-1.5">
                        <Send size={14} className="text-sky-600 shrink-0" />
                        <span>
                          {existingPV.publieLe
                            ? 'Séance publiée par la Structure'
                            : `Transmis à la Structure${existingPV.envoyeLe ? ` le ${formatJJMM(existingPV.envoyeLe.split('T')[0])}` : ''}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      >
                        <Send size={14} />
                        <span>Envoyé à la Structure</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Validation des 3 signatures papier et dépôt direct chez le Directeur de structure */}
                {existingPV &&
                  !existingPV.rouvertLe &&
                  (existingPV.statut === 'a_signer' || existingPV.statut === 'signe') && (() => {
                    const checks = getSignatureChecks(existingPV.id);
                    const all3Checked = checks[0] && checks[1] && checks[2];
                    return (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                          <FileSignature size={14} className="text-indigo-700 shrink-0" />
                          <span>{fr.commission.signatures3Title}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-800 bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checks[0]}
                              onChange={() => handleToggleSignatureCheck(existingPV.id, 0)}
                              className="rounded border-slate-300 text-indigo-700 focus:ring-indigo-500"
                            />
                            <span>{fr.commission.signatures3Check1}</span>
                          </label>
                          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-800 bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checks[1]}
                              onChange={() => handleToggleSignatureCheck(existingPV.id, 1)}
                              className="rounded border-slate-300 text-indigo-700 focus:ring-indigo-500"
                            />
                            <span>{fr.commission.signatures3Check2}</span>
                          </label>
                          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-800 bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checks[2]}
                              onChange={() => handleToggleSignatureCheck(existingPV.id, 2)}
                              className="rounded border-slate-300 text-indigo-700 focus:ring-indigo-500"
                            />
                            <span>{fr.commission.signatures3Check3}</span>
                          </label>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          {!all3Checked ? (
                            <span className="text-[11px] text-amber-800 font-medium">
                              {fr.commission.signatures3RequiredHint}
                            </span>
                          ) : (
                            <span className="text-[11px] text-indigo-800 font-medium">
                              3/3 signatures attestées · Réf. {(existingPV.code || '').slice(0, 6)}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={!all3Checked}
                            onClick={() => handleValider3SignaturesEtDeposer(existingPV.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl shadow-xs transition cursor-pointer"
                          >
                            <FileCheck2 size={14} />
                            <span>{fr.commission.btnValider3SignaturesDeposer}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                {/* Option de réouverture si PV existant non publié */}
                {existingPV && !existingPV.publieLe && !existingPV.rouvertLe && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReopenModalDate(date);
                        setReopenMotif('');
                        setReopenError(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-amber-800 transition cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>{fr.commission.btnReopenPV}</span>
                    </button>
                  </div>
                )}

                {/* Modal de réouverture */}
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

                {/* Modal de signalement d'empêchement */}
                {empechementModalDate === date && (
                  <div className="mt-3 p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-700" />
                        <span>{fr.commission.modalEmpechementTitre}</span>
                      </h5>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        {fr.commission.modalEmpechementDesc}
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {fr.commission.modalEmpechementMotifLabel}
                      </label>
                      <input
                        type="text"
                        value={empechementMotif}
                        onChange={(e) => {
                          setEmpechementMotif(e.target.value);
                          setEmpechementError(null);
                        }}
                        placeholder={fr.commission.modalEmpechementMotifPlaceholder}
                        className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {empechementError && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{empechementError}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEmpechementModalDate(null);
                          setEmpechementMotif('');
                          setEmpechementError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                      >
                        {fr.common.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmEmpechement(date)}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs transition cursor-pointer"
                      >
                        {fr.commission.btnConfirmerEmpechement}
                      </button>
                    </div>
                  </div>
                )}

                {/* Versions précédentes remplacées (lecture seule) */}
                {getReplacedPVsForDate(date).length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw size={12} className="text-slate-400" />
                      <span>{fr.commission.previousVersionsTitle}</span>
                    </h5>
                    <div className="space-y-1.5">
                      {getReplacedPVsForDate(date).map((oldPv) => {
                        const oldRef = `PV du ${formatJJMM(oldPv.date)} · ${(oldPv.code || '').slice(0, 4)}`;
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
  );
};
