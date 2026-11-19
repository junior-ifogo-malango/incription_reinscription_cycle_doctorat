import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  AlertCircle,
  Clock,
  MapPin,
  UserCheck,
  MessageCircle,
  Mail,
  CheckCircle2,
  Edit3,
  XCircle,
  RefreshCw,
  X,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { Candidat, Creneau, Sujet, dossierComplet } from '../types';
import { fr } from '../i18n/fr';
import { storageService } from '../services/storage';
import { INITIAL_ENSEIGNANTS, INITIAL_SUJETS, MOCK_CANDIDATS, aujourdhui } from '../data/mockData';
import { sendAdmissionEmail } from '../emailConfig';
import { logConvocationEnvoyee, logEvent, ActeurJournal } from '../utils/journal';
import {
  normaliserTel,
  lienWhatsApp,
  ouvrirLien,
  messageConvocation,
  messageConvocationAnnulee,
  trouverCandidat,
  ajouterNotification,
  reconcileCandidateFromStorage,
  persistUnifiedCandidate,
} from '../utils/messages';

const STORAGE_KEY_CRENEAUX = 'usmba_doctorat_creneaux';

interface MesCreneauxProps {
  enseignantId?: string;
  onOpenDossier?: (candidatId: string, candidatNom: string) => void;
}

function formatDateJJMMAAAA(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDirectorActor(enseignantId: string): ActeurJournal {
  try {
    const rawActive = localStorage.getItem('usmba_active_account');
    if (rawActive) {
      const acc = JSON.parse(rawActive);
      if (acc && acc.id) {
        return {
          id: acc.enseignantId || acc.id,
          nom: acc.nom || fr.auth.roleEnseignantBadge,
          role: 'enseignant',
        };
      }
    }
  } catch {
    // fallback
  }
  const ens = INITIAL_ENSEIGNANTS.find((e) => e.id === enseignantId);
  return {
    id: enseignantId,
    nom: ens?.nom || fr.auth.roleEnseignantBadge,
    role: 'enseignant',
  };
}

function readAllStoredCreneaux(): Creneau[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // fallback
  }
  return storageService.getCreneaux();
}

interface TeacherCandidateRow {
  candidat: Candidat;
  fullName: string;
  sujet: Sujet;
  isSent: boolean;
  isValide: boolean;
  isConvoque: boolean;
  complet: boolean;
  manques: string[];
}

function readTeacherCandidatesForConvocations(
  enseignantId: string,
  allCreneaux: Creneau[]
): TeacherCandidateRow[] {
  let allSujets: Sujet[] = INITIAL_SUJETS;
  try {
    const rawSujets = localStorage.getItem('usmba_doctorat_sujets');
    if (rawSujets) {
      const parsed = JSON.parse(rawSujets);
      if (Array.isArray(parsed) && parsed.length > 0) allSujets = parsed;
    }
  } catch {}

  const teacherSubjects = allSujets.filter((s) => s && s.enseignantId === enseignantId);
  const teacherSubjectIds = new Set(teacherSubjects.map((s) => s.id));
  if (teacherSubjectIds.size === 0) return [];

  let simulatedStatuts: Record<string, string> = {};
  try {
    const rawSim = localStorage.getItem('usmba_simulated_statuts');
    if (rawSim) simulatedStatuts = JSON.parse(rawSim) || {};
  } catch {}

  const candidatesById = new Map<string, Candidat>();
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) {
        accounts.forEach((a) => {
          if (a && a.id) candidatesById.set(a.id, a);
        });
      }
    }
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      Object.values(overrides).forEach((c) => {
        if (c && c.id) candidatesById.set(c.id, c);
      });
    }
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur && cur.compteCree && cur.id) {
        candidatesById.set(cur.id, cur);
      }
    }
  } catch {}

  MOCK_CANDIDATS.forEach((mc) => {
    if (mc && mc.id && !candidatesById.has(mc.id) && mc.compteCree) {
      candidatesById.set(mc.id, mc);
    }
  });

  const rows: TeacherCandidateRow[] = [];

  candidatesById.forEach((rawCand) => {
    const cand = reconcileCandidateFromStorage(rawCand);
    if (!cand.compteCree || !Array.isArray(cand.candidatures)) return;

    const matchingSujetId = cand.candidatures.find((id) => teacherSubjectIds.has(id));
    if (!matchingSujetId) return;

    const sujet = teacherSubjects.find((s) => s.id === matchingSujetId);
    if (!sujet) return;

    const statuts = cand.candidaturesStatuts || {};
    const simStatut = simulatedStatuts[`${cand.id}-${sujet.id}`];
    const isValide =
      statuts[sujet.id] === 'retenue' ||
      simStatut === 'retenue' ||
      Object.values(statuts).some((s) => s === 'retenue');

    const hasACorr = Object.values(statuts).some((s) => s === 'a_corriger');
    const hasLegacySent = Boolean(
      !hasACorr &&
      (cand.envoyeLe ||
        (cand.candidaturesEnvoyeLe && Object.keys(cand.candidaturesEnvoyeLe).length > 0) ||
        isValide)
    );
    const isSent = Boolean(cand.dossier?.dateEnvoi || hasLegacySent);

    const isConvoque = allCreneaux.some(
      (c) =>
        c.candidatId === cand.id &&
        c.enseignantId === enseignantId &&
        (c.statut === 'reserve' || c.statut === 'confirme')
    );

    const check = dossierComplet(cand);
    const resolvedInfo = trouverCandidat(cand.id);
    const fullName =
      resolvedInfo.nom ||
      (cand.nomFamille?.trim() && cand.prenom?.trim()
        ? `${cand.prenom.trim()} ${cand.nomFamille.trim()}`
        : cand.nom?.trim()) ||
      fr.mesCreneaux.nonRenseigne;

    rows.push({
      candidat: cand,
      fullName,
      sujet,
      isSent,
      isValide,
      isConvoque,
      complet: check.complet,
      manques: check.manques,
    });
  });

  return rows;
}

export const MesCreneaux: React.FC<MesCreneauxProps> = ({
  enseignantId = 'ens-1',
  onOpenDossier,
}) => {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherCandidateRow[]>([]);

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editHeure, setEditHeure] = useState('');
  const [editLieu, setEditLieu] = useState('');

  const [convoquerTarget, setConvoquerTarget] = useState<TeacherCandidateRow | null>(null);
  const [convoquerDate, setConvoquerDate] = useState('');
  const [convoquerHeure, setConvoquerHeure] = useState('');
  const [convoquerLieu, setConvoquerLieu] = useState('');
  const [convoquerSubmitting, setConvoquerSubmitting] = useState(false);

  const [cancelModalSlot, setCancelModalSlot] = useState<Creneau | null>(null);
  const [cancelMotif, setCancelMotif] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [sendingEmailMap, setSendingEmailMap] = useState<Record<string, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(() => {
    const allCreneaux = readAllStoredCreneaux();
    setCreneaux(allCreneaux);
    setTeacherRows(readTeacherCandidatesForConvocations(enseignantId, allCreneaux));
  }, [enseignantId]);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('usmba_creneaux_updated', handleSync);
    window.addEventListener('usmba_candidat_updated', handleSync);
    window.addEventListener('usmba_pieces_updated', handleSync);
    window.addEventListener('usmba_dossier_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('usmba_creneaux_updated', handleSync);
      window.removeEventListener('usmba_candidat_updated', handleSync);
      window.removeEventListener('usmba_pieces_updated', handleSync);
      window.removeEventListener('usmba_dossier_updated', handleSync);
    };
  }, [loadData]);

  const persistCreneaux = (updatedList: Creneau[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(updatedList));
      setCreneaux(updatedList);
      setErrorMsg(null);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      return true;
    } catch {
      setErrorMsg(fr.mesCreneaux.storageQuotaError);
      return false;
    }
  };

  const updateSlotFields = (slotId: string, patch: Partial<Creneau>) => {
    const fresh = readAllStoredCreneaux();
    const updated = fresh.map((c) => (c.id === slotId ? { ...c, ...patch } : c));
    persistCreneaux(updated);
  };

  const sendConvocationEmailAndTrack = async (
    slot: Creneau,
    candidatNom: string,
    candidatEmail: string | undefined,
    messageText: string,
    canalLabel: string
  ) => {
    setSendingEmailMap((prev) => ({ ...prev, [slot.id]: true }));
    const acteur = getDirectorActor(enseignantId);
    try {
      const result = await sendAdmissionEmail({
        toEmail: candidatEmail || '',
        toName: candidatNom,
        message: messageText,
      });
      const nowIso = new Date().toISOString();
      if (result.ok) {
        updateSlotFields(slot.id, {
          emailStatut: 'envoye',
          emailErreur: undefined,
          emailEnvoyeLe: nowIso,
        });
        logConvocationEnvoyee(
          acteur,
          candidatNom,
          canalLabel,
          formatDateJJMMAAAA(slot.date),
          fr.mesCreneaux.emailSentLabel
        );
      } else {
        const reason = result.error || fr.cedSeances.emailNetworkError;
        updateSlotFields(slot.id, {
          emailStatut: 'echec',
          emailErreur: reason,
        });
        logConvocationEnvoyee(
          acteur,
          candidatNom,
          canalLabel,
          formatDateJJMMAAAA(slot.date),
          `${fr.mesCreneaux.emailFailedPrefix} ${reason}`
        );
      }
    } finally {
      setSendingEmailMap((prev) => ({ ...prev, [slot.id]: false }));
    }
  };

  const handleStartEdit = (slot: Creneau) => {
    setEditingSlotId(slot.id);
    setEditDate(slot.date);
    setEditHeure(slot.heure);
    setEditLieu(slot.lieu);
    setFeedbackMsg(null);
  };

  const isEditValid = Boolean(editDate.trim() && editHeure.trim() && editLieu.trim());

  const handleSaveEdit = async (e: React.FormEvent, slot: Creneau) => {
    e.preventDefault();
    if (!isEditValid) return;

    const trimmedDate = editDate.trim();
    const trimmedHeure = editHeure.trim();
    const trimmedLieu = editLieu.trim();
    const nowIso = new Date().toISOString();

    const updatedSlot: Creneau = {
      ...slot,
      date: trimmedDate,
      heure: trimmedHeure,
      lieu: trimmedLieu,
      statut: 'reserve',
      dateReservation: nowIso,
      dateConfirmation: undefined,
      emailStatut: undefined,
      emailErreur: undefined,
      emailEnvoyeLe: undefined,
      whatsappOuvertLe: undefined,
    };

    const fresh = readAllStoredCreneaux();
    const nextList = fresh.map((c) => (c.id === slot.id ? updatedSlot : c));
    if (!persistCreneaux(nextList)) return;

    setEditingSlotId(null);

    if (slot.candidatId) {
      const candInfo = trouverCandidat(slot.candidatId);
      const fullName = candInfo.nom || fr.mesCreneaux.nonRenseigne;
      const msg = messageConvocation(trimmedDate, trimmedHeure, trimmedLieu);

      ajouterNotification({
        destinataireId: slot.candidatId,
        texte: msg,
        type: 'action',
        actionLabel: fr.notifications.btnAllerEntretiens,
        actionTab: 'entretiens',
      });

      setFeedbackMsg({ type: 'success', text: fr.mesCreneaux.convocationUpdatedMsg });
      await sendConvocationEmailAndTrack(
        updatedSlot,
        fullName,
        candInfo.email,
        msg,
        'E-mail (modification)'
      );
    }
  };

  const handleOpenCancelModal = (slot: Creneau) => {
    setCancelModalSlot(slot);
    setCancelMotif('');
    setCancelError(null);
  };

  const isCancelMotifValid = cancelMotif.trim().length >= 5;

  const handleConfirmCancel = async () => {
    if (!cancelModalSlot) return;
    const trimmedMotif = cancelMotif.trim();
    if (trimmedMotif.length < 5) {
      setCancelError(fr.mesCreneaux.motifAnnulationError);
      return;
    }

    const slot = cancelModalSlot;
    const fresh = readAllStoredCreneaux();
    const nextList = fresh.filter((c) => c.id !== slot.id);
    if (!persistCreneaux(nextList)) return;

    setCancelModalSlot(null);
    setCancelMotif('');
    setCancelError(null);
    loadData();

    if (slot.candidatId) {
      const candInfo = trouverCandidat(slot.candidatId);
      const fullName = candInfo.nom || fr.mesCreneaux.nonRenseigne;
      const msg = messageConvocationAnnulee(slot.date, slot.heure, slot.lieu, trimmedMotif);

      ajouterNotification({
        destinataireId: slot.candidatId,
        texte: msg,
        type: 'action',
        actionLabel: fr.notifications.btnAllerEntretiens,
        actionTab: 'entretiens',
      });

      const acteur = getDirectorActor(enseignantId);
      const result = await sendAdmissionEmail({
        toEmail: candInfo.email || '',
        toName: fullName,
        message: msg,
      });

      const emailStatusText = result.ok
        ? fr.mesCreneaux.emailSentLabel
        : `${fr.mesCreneaux.emailFailedPrefix} ${result.error || fr.cedSeances.emailNetworkError}`;

      logConvocationEnvoyee(
        acteur,
        fullName,
        'E-mail (annulation)',
        formatDateJJMMAAAA(slot.date),
        emailStatusText
      );

      setFeedbackMsg({
        type: result.ok ? 'success' : 'info',
        text: `${fr.mesCreneaux.convocationCancelledMsg} (${emailStatusText})`,
      });
    }
  };

  const handleResendEmail = async (slot: Creneau) => {
    if (!slot.candidatId) return;
    const candInfo = trouverCandidat(slot.candidatId);
    const fullName = candInfo.nom || fr.mesCreneaux.nonRenseigne;
    const msg = messageConvocation(slot.date, slot.heure, slot.lieu);
    await sendConvocationEmailAndTrack(slot, fullName, candInfo.email, msg, 'E-mail');
  };

  const handleOpenWhatsApp = (slot: Creneau, waUrl: string, fullName: string) => {
    ouvrirLien(waUrl);
    const nowIso = new Date().toISOString();
    updateSlotFields(slot.id, { whatsappOuvertLe: nowIso });
    const acteur = getDirectorActor(enseignantId);
    logConvocationEnvoyee(
      acteur,
      fullName,
      'WhatsApp',
      formatDateJJMMAAAA(slot.date),
      `${fr.mesCreneaux.whatsappOpenedOn} ${formatDateJJMMAAAA(nowIso)}`
    );
  };

  const handleValiderFromConvocations = (row: TeacherCandidateRow) => {
    if (!row.complet || !row.isSent) return;
    const updatedStatuts = {
      ...(row.candidat.candidaturesStatuts || {}),
      [row.sujet.id]: 'retenue' as const,
    };
    const updatedCand: Candidat = {
      ...row.candidat,
      candidaturesStatuts: updatedStatuts,
    };
    const merged = persistUnifiedCandidate(updatedCand, true);

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      const parsed = rawSim ? JSON.parse(rawSim) : {};
      parsed[`${row.candidat.id}-${row.sujet.id}`] = 'retenue';
      localStorage.setItem('usmba_simulated_statuts', JSON.stringify(parsed));
    } catch {}

    const acteur = getDirectorActor(enseignantId);
    logEvent(
      acteur,
      fr.journalActions.candidatureValidee,
      `${row.fullName} (${row.sujet.titre})`
    );

    try {
      window.dispatchEvent(new CustomEvent('usmba_candidat_updated', { detail: merged }));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch {}

    setFeedbackMsg({ type: 'success', text: fr.mesCreneaux.valideDepuisConvocationMsg });
    loadData();
  };

  const handleOpenConvoquer = (row: TeacherCandidateRow) => {
    const currentCreneaux = readAllStoredCreneaux();
    const myWithLieu = currentCreneaux.filter(
      (c) => c.enseignantId === enseignantId && Boolean(c.lieu && c.lieu.trim())
    );
    const lastLieu = myWithLieu.length > 0 ? myWithLieu[myWithLieu.length - 1].lieu.trim() : '';
    setConvoquerTarget(row);
    setConvoquerDate('');
    setConvoquerHeure('');
    setConvoquerLieu(lastLieu);
    setFeedbackMsg(null);
  };

  const todayDateStr = aujourdhui();
  const hasAllConvoquerFields = Boolean(
    convoquerDate.trim() && convoquerHeure.trim() && convoquerLieu.trim()
  );
  const isConvoquerPastDate = Boolean(
    convoquerDate.trim() && convoquerDate.trim() < todayDateStr
  );
  const canSubmitConvoquer =
    hasAllConvoquerFields && !isConvoquerPastDate && !convoquerSubmitting;
  const convoquerDisabledReason = !hasAllConvoquerFields
    ? fr.dossierDirecteur.convoquerDisabledMissing
    : isConvoquerPastDate
    ? fr.dossierDirecteur.convoquerDisabledPastDate
    : null;

  const handleConfirmConvoquer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convoquerTarget || !canSubmitConvoquer) return;

    const target = convoquerTarget;
    const trimmedDate = convoquerDate.trim();
    const trimmedHeure = convoquerHeure.trim();
    const trimmedLieu = convoquerLieu.trim();
    const freshCreneaux = readAllStoredCreneaux();

    const alreadyConvoked = freshCreneaux.some(
      (c) =>
        c.candidatId === target.candidat.id &&
        c.enseignantId === enseignantId &&
        (c.statut === 'reserve' || c.statut === 'confirme')
    );
    if (alreadyConvoked) {
      setConvoquerTarget(null);
      loadData();
      return;
    }

    setConvoquerSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const newSlot: Creneau = {
        id: `cr-${Date.now()}`,
        enseignantId,
        date: trimmedDate,
        heure: trimmedHeure,
        lieu: trimmedLieu,
        candidatId: target.candidat.id,
        statut: 'reserve',
        dateReservation: nowIso,
      };
      const nextList = [...freshCreneaux, newSlot];
      if (!persistCreneaux(nextList)) return;

      setConvoquerTarget(null);
      loadData();

      const candInfo = trouverCandidat(target.candidat.id);
      const fullName = candInfo.nom || target.fullName;
      const emailToUse = candInfo.email || target.candidat.email || '';
      const msg = messageConvocation(trimmedDate, trimmedHeure, trimmedLieu);

      ajouterNotification({
        destinataireId: target.candidat.id,
        destinataireEmail: emailToUse || undefined,
        texte: msg,
        type: 'action',
        actionLabel: fr.notifications.btnAllerEntretiens,
        actionTab: 'entretiens',
      });

      setFeedbackMsg({
        type: 'success',
        text: fr.dossierDirecteur.convocationSentFeedback
          .replace('{date}', formatDateJJMMAAAA(trimmedDate))
          .replace('{heure}', trimmedHeure),
      });

      await sendConvocationEmailAndTrack(newSlot, fullName, emailToUse, msg, 'E-mail');
      loadData();
    } finally {
      setConvoquerSubmitting(false);
    }
  };

  const myConvocations = creneaux
    .filter(
      (c) =>
        c.enseignantId === enseignantId &&
        Boolean(c.candidatId) &&
        (c.statut === 'reserve' || c.statut === 'confirme' || c.statut === 'absent')
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.heure.localeCompare(b.heure);
    });

  const aConvoquerList = teacherRows.filter((r) => r.isValide && !r.isConvoque);
  const aValiderList = teacherRows.filter((r) => r.isSent && !r.isValide);

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.mesCreneaux.title}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {aValiderList.length} à valider · {aConvoquerList.length} à convoquer · {myConvocations.length}{' '}
            {myConvocations.length > 1 ? 'convocations' : 'convocation'}
          </p>
        </div>

        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
          <Calendar size={18} />
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 size={15} className="shrink-0 text-emerald-700" />
          ) : (
            <AlertCircle size={15} className="shrink-0 text-amber-700" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Candidats à convoquer (validés et pas encore convoqués) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircle size={14} className={aConvoquerList.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
            <span>{fr.mesCreneaux.sectionAConvoquerTitle}</span>
          </h3>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              aConvoquerList.length > 0
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {aConvoquerList.length}
          </span>
        </div>

        {aConvoquerList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
            {fr.mesCreneaux.emptyAConvoquer}
          </div>
        ) : (
          <div className="space-y-2.5">
            {aConvoquerList.map((row) => (
              <div
                key={`convoq-${row.candidat.id}-${row.sujet.id}`}
                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{row.fullName}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                      <span>{fr.dossierDirecteur.badgeValidee}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertCircle size={11} className="text-rose-600 shrink-0" />
                      <span>{fr.mesCreneaux.badgeAConvoquer}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">{row.sujet.titre}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {onOpenDossier && (
                    <button
                      type="button"
                      onClick={() => onOpenDossier(row.candidat.id, row.fullName)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      <span>{fr.mesCreneaux.btnOuvrirDossier}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenConvoquer(row)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Calendar size={13} />
                    <span>{fr.mesCreneaux.btnConvoquer}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Candidatures à valider (envoyées et non encore validées) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle size={14} className={aValiderList.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
            <span>{fr.mesCreneaux.sectionAValiderTitle}</span>
          </h3>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              aValiderList.length > 0
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {aValiderList.length}
          </span>
        </div>

        {aValiderList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
            {fr.mesCreneaux.emptyAValider}
          </div>
        ) : (
          <div className="space-y-2.5">
            {aValiderList.map((row) => (
              <div
                key={`valider-${row.candidat.id}-${row.sujet.id}`}
                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{row.fullName}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                      <XCircle size={11} className="text-rose-600 shrink-0" />
                      <span>{fr.mesCreneaux.badgeAValider}</span>
                    </span>
                    {row.complet ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                        <span>{fr.dossierDirecteur.verdictComplet}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                        <AlertCircle size={11} className="text-amber-700 shrink-0" />
                        <span>
                          {fr.dossierDirecteur.verdictIncomplet.replace('{manques}', row.manques.join(', '))}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">{row.sujet.titre}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {onOpenDossier && (
                    <button
                      type="button"
                      onClick={() => onOpenDossier(row.candidat.id, row.fullName)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      <span>{fr.mesCreneaux.btnOuvrirDossier}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!row.complet}
                    onClick={() => handleValiderFromConvocations(row)}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 ${
                      row.complet
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>{fr.mesCreneaux.btnValider}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Liste des convocations envoyées */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide px-1">
          {fr.mesCreneaux.listTitle}
        </h3>

        {myConvocations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            {fr.mesCreneaux.emptyList}
          </div>
        ) : (
          <div className="space-y-2.5">
            {myConvocations.map((slot) => {
              const candInfo = trouverCandidat(slot.candidatId);
              const fullName = candInfo.nom || fr.mesCreneaux.nonRenseigne;
              const dateFr = formatDateJJMMAAAA(slot.date);
              const convocationLine = fr.mesCreneaux.convocationLine
                .replace('{date}', dateFr)
                .replace('{heure}', slot.heure)
                .replace('{lieu}', slot.lieu);

              const convocationText = messageConvocation(slot.date, slot.heure, slot.lieu);
              const rawTel = candInfo.tel?.trim() || '';
              const normalizedTel = normaliserTel(rawTel);
              const waUrl = normalizedTel ? lienWhatsApp(rawTel, convocationText) : null;
              const waDisabledReason = !rawTel
                ? fr.mesCreneaux.whatsappMissingReason
                : !normalizedTel
                ? fr.mesCreneaux.whatsappInvalidReason
                : null;

              const isSendingEmail = Boolean(sendingEmailMap[slot.id]);
              const isPresent = slot.presence === 'present';
              const isAbsent = slot.statut === 'absent' || slot.presence === 'absent';
              const isConfirmed = slot.statut === 'confirme';
              const isEditingThis = editingSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                          <UserCheck size={14} className="text-emerald-700 shrink-0" />
                          <span>{fullName}</span>
                        </span>

                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                            <span>{fr.mesCreneaux.badgePresent}</span>
                          </span>
                        ) : isAbsent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle size={12} className="text-rose-600 shrink-0" />
                            <span>{fr.mesCreneaux.badgeAbsent}</span>
                          </span>
                        ) : isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                            <span>{fr.mesCreneaux.badgeConfirme}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={12} className="text-amber-600 shrink-0" />
                            <span>{fr.mesCreneaux.badgeConvoque}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 flex items-center gap-1.5">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>{convocationLine}</span>
                      </p>
                    </div>

                    {/* Boutons Modifier / Annuler la convocation */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(slot)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>{fr.mesCreneaux.btnModifier}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCancelModal(slot)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <XCircle size={12} />
                        <span>{fr.mesCreneaux.btnAnnulerConvocation}</span>
                      </button>
                    </div>
                  </div>

                  {/* Formulaire inline de modification */}
                  {isEditingThis && (
                    <form
                      onSubmit={(e) => handleSaveEdit(e, slot)}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {fr.mesCreneaux.dateLabel}
                          </label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {fr.mesCreneaux.heureLabel}
                          </label>
                          <input
                            type="time"
                            value={editHeure}
                            onChange={(e) => setEditHeure(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {fr.mesCreneaux.lieuLabel}
                          </label>
                          <input
                            type="text"
                            value={editLieu}
                            onChange={(e) => setEditLieu(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="submit"
                          disabled={!isEditValid}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isEditValid
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                              : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                          }`}
                        >
                          {fr.mesCreneaux.btnSaveEdit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSlotId(null)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
                        >
                          {fr.mesCreneaux.btnFermer}
                        </button>
                      </div>
                      {!isEditValid && (
                        <p className="text-[11px] text-amber-800 font-medium">
                          {fr.mesCreneaux.editDisabledReason}
                        </p>
                      )}
                    </form>
                  )}

                  {/* Statut réel E-mail + Bouton réel WhatsApp */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSendingEmail ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Clock size={13} className="text-slate-500 shrink-0" />
                          <span>{fr.mesCreneaux.emailSendingLabel}</span>
                        </span>
                      ) : slot.emailStatut === 'envoye' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                          <Mail size={13} className="text-emerald-600 shrink-0" />
                          <span>{fr.mesCreneaux.emailSentLabel}</span>
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                            <AlertCircle size={13} className="text-rose-600 shrink-0" />
                            <span>
                              {fr.mesCreneaux.emailFailedPrefix}{' '}
                              {slot.emailErreur || fr.cedSeances.emailNetworkError}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResendEmail(slot)}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer transition-colors"
                          >
                            <RefreshCw size={12} />
                            <span>{fr.mesCreneaux.btnRenvoyerEmail}</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <button
                        type="button"
                        disabled={!waUrl}
                        onClick={() => waUrl && handleOpenWhatsApp(slot, waUrl, fullName)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                          waUrl
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <MessageCircle size={13} />
                        <span>{fr.mesCreneaux.btnEnvoyerWhatsapp}</span>
                      </button>
                      {waDisabledReason && (
                        <p className="text-[11px] font-medium text-amber-800">
                          {waDisabledReason}
                        </p>
                      )}
                      {waUrl && slot.whatsappOuvertLe && (
                        <p className="text-[11px] font-medium text-emerald-700 inline-flex items-center gap-1">
                          <MessageCircle size={11} className="shrink-0" />
                          <span>
                            {fr.mesCreneaux.whatsappOpenedOn}{' '}
                            {formatDateJJMMAAAA(slot.whatsappOuvertLe)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal d'annulation de convocation (motif >= 5 caractères) */}
      {cancelModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle size={16} className="text-rose-600" />
                <span>{fr.mesCreneaux.modalAnnulerTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancelModalSlot(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label={fr.mesCreneaux.btnFermer}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="motif-annulation-input"
                className="block text-xs font-semibold text-slate-700"
              >
                {fr.mesCreneaux.motifAnnulationLabel}
              </label>
              <textarea
                id="motif-annulation-input"
                rows={3}
                value={cancelMotif}
                onChange={(e) => {
                  setCancelMotif(e.target.value);
                  setCancelError(null);
                }}
                placeholder={fr.mesCreneaux.motifAnnulationPlaceholder}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-600"
              />
              {cancelError && (
                <p className="text-[11px] text-rose-600 font-medium">{cancelError}</p>
              )}
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-1.5 pt-1">
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setCancelModalSlot(null)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  {fr.mesCreneaux.btnFermer}
                </button>
                <button
                  type="button"
                  disabled={!isCancelMotifValid}
                  onClick={handleConfirmCancel}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isCancelMotifValid
                      ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  }`}
                >
                  {fr.mesCreneaux.btnConfirmerAnnulation}
                </button>
              </div>
              {!isCancelMotifValid && (
                <p className="text-[11px] text-amber-800 font-medium">
                  {fr.mesCreneaux.motifAnnulationError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Convoquer un candidat depuis Convocations */}
      {convoquerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-emerald-700" />
                  <span>{fr.dossierDirecteur.modalConvoquerTitle}</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-semibold">{convoquerTarget.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setConvoquerTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label={fr.dossierDirecteur.convoquerFermer}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmConvoquer} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="convoc-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    {fr.dossierDirecteur.convoquerDateLabel} *
                  </label>
                  <input
                    id="convoc-date"
                    type="date"
                    value={convoquerDate}
                    onChange={(e) => setConvoquerDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="convoc-heure" className="block text-xs font-semibold text-slate-700 mb-1">
                    {fr.dossierDirecteur.convoquerHeureLabel} *
                  </label>
                  <input
                    id="convoc-heure"
                    type="time"
                    value={convoquerHeure}
                    onChange={(e) => setConvoquerHeure(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="convoc-lieu" className="block text-xs font-semibold text-slate-700 mb-1">
                  {fr.dossierDirecteur.convoquerLieuLabel} *
                </label>
                <input
                  id="convoc-lieu"
                  type="text"
                  value={convoquerLieu}
                  onChange={(e) => setConvoquerLieu(e.target.value)}
                  placeholder={fr.dossierDirecteur.convoquerLieuPlaceholder}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                />
              </div>

              {convoquerDisabledReason && (
                <p className="text-[11px] text-amber-800 font-medium">{convoquerDisabledReason}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConvoquerTarget(null)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  {fr.dossierDirecteur.convoquerFermer}
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitConvoquer}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    canSubmitConvoquer
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {fr.mesCreneaux.btnConvoquer}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

