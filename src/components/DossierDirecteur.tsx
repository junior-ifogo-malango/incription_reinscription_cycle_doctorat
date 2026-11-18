import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Eye,
  X,
  ExternalLink,
  FileText,
  GraduationCap,
  BookOpen,
  Send,
  Calendar,
  Clock,
} from 'lucide-react';
import { Candidat, Creneau, Sujet, Piece, AnomalieCandidature, Notification, dossierComplet } from '../types';
import { INITIAL_SUJETS, MOCK_CANDIDATS, aujourdhui } from '../data/mockData';
import { fr } from '../i18n/fr';
import { lireJournal, logEvent, logConvocationEnvoyee } from '../utils/journal';
import { sendAdmissionEmail } from '../emailConfig';
import { messageConvocation, trouverCandidat, ajouterNotification } from '../utils/messages';

const STORAGE_KEY_CRENEAUX = 'usmba_doctorat_creneaux';

export interface DossierDirecteurProps {
  candidatId: string;
  onRetour: () => void;
  enseignantId?: string;
  onVoirConvocation?: () => void;
}

function readStoredCreneaux(): Creneau[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function formatDateJJMM(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [, mm, dd] = clean.split('-');
    return `${dd}/${mm}`;
  }
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return clean;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatDateJJMMAAAA(dateStr?: string): string {
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

function findCandidate(id: string): Candidat | null {
  if (!id) return null;
  let foundCandidate: Candidat | null = null;
  let registeredAccounts: Candidat[] = [];

  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) registeredAccounts = accounts;
    }
  } catch {}

  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (overrides[id]) foundCandidate = overrides[id];
    }
  } catch {}

  if (!foundCandidate) {
    try {
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (cur.id === id) foundCandidate = cur;
      }
    } catch {}
  }

  const accMatch = registeredAccounts.find((a) => a.id === id) || null;
  if (!foundCandidate && accMatch) {
    foundCandidate = accMatch;
  }

  const mockMatch = MOCK_CANDIDATS.find((c) => c.id === id) || null;
  if (!foundCandidate && mockMatch) {
    foundCandidate = mockMatch;
  }

  if (foundCandidate && !foundCandidate.email?.trim()) {
    const resolvedEmail =
      accMatch?.email?.trim() ||
      mockMatch?.email?.trim() ||
      registeredAccounts.find(
        (a) =>
          a.email?.trim() &&
          ((foundCandidate!.cne && a.cne?.trim().toUpperCase() === foundCandidate!.cne.trim().toUpperCase()) ||
            (foundCandidate!.cin && a.cin?.trim().toUpperCase() === foundCandidate!.cin.trim().toUpperCase()))
      )?.email?.trim() ||
      '';
    if (resolvedEmail) {
      return { ...foundCandidate, email: resolvedEmail };
    }
  }

  return foundCandidate;
}

function persistCandidate(cand: Candidat): void {
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    const overrides: Record<string, Candidat> = rawOverrides ? JSON.parse(rawOverrides) : {};
    overrides[cand.id] = cand;
    localStorage.setItem('usmba_candidats_overrides', JSON.stringify(overrides));

    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.id === cand.id) {
        localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(cand));
      }
    }

    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      const idx = accounts.findIndex((a) => a.id === cand.id);
      if (idx !== -1) {
        accounts[idx] = cand;
        localStorage.setItem('usmba_registered_accounts', JSON.stringify(accounts));
      }
    }
    window.dispatchEvent(new CustomEvent('usmba_candidat_updated', { detail: cand }));
  } catch {}
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
  } catch {
    // Échec sans plantage
  }
}

function isPdfData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:application/pdf') || data.toLowerCase().endsWith('.pdf');
}

function isImageData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return (
    data.startsWith('data:image') ||
    data.includes('.svg') ||
    data.match(/\.(png|jpe?g|webp|gif)$/i) !== null
  );
}

export const DossierDirecteur: React.FC<DossierDirecteurProps> = ({
  candidatId,
  onRetour,
  enseignantId = 'ens-1',
  onVoirConvocation,
}) => {
  const [candidat, setCandidat] = useState<Candidat | null>(() => findCandidate(candidatId));
  const [creneaux, setCreneaux] = useState<Creneau[]>(() => readStoredCreneaux());
  const [feedback, setFeedback] = useState<string | null>(null);

  // Aperçu pièce plein écran
  const [viewingPiece, setViewingPiece] = useState<{ titre: string; fichier: string } | null>(null);
  const [pieceIllisible, setPieceIllisible] = useState<boolean>(false);

  // Modale "Demander de compléter"
  const [showDemandeModal, setShowDemandeModal] = useState<boolean>(false);
  const [demandePiece, setDemandePiece] = useState<'CIN' | 'DIPLOME' | 'RELEVES'>('CIN');
  const [demandeMotif, setDemandeMotif] = useState<string>('');
  const [demandeError, setDemandeError] = useState<string | null>(null);

  // Modale "Convoquer"
  const [showConvoquerModal, setShowConvoquerModal] = useState<boolean>(false);
  const [convoquerDate, setConvoquerDate] = useState<string>('');
  const [convoquerHeure, setConvoquerHeure] = useState<string>('');
  const [convoquerLieu, setConvoquerLieu] = useState<string>('');
  const [convoquerSubmitting, setConvoquerSubmitting] = useState<boolean>(false);

  // Synchronisation des données
  useEffect(() => {
    const syncAll = () => {
      setCandidat(findCandidate(candidatId));
      setCreneaux(readStoredCreneaux());
    };
    syncAll();
    window.addEventListener('usmba_creneaux_updated', syncAll);
    window.addEventListener('usmba_candidat_updated', syncAll);
    window.addEventListener('storage', syncAll);
    return () => {
      window.removeEventListener('usmba_creneaux_updated', syncAll);
      window.removeEventListener('usmba_candidat_updated', syncAll);
      window.removeEventListener('storage', syncAll);
    };
  }, [candidatId]);

  useEffect(() => {
    if (!showConvoquerModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConvoquerModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showConvoquerModal]);

  // Tous les sujets
  const allSujets: Sujet[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_sujets');
      if (raw) return JSON.parse(raw);
    } catch {}
    return INITIAL_SUJETS;
  }, []);

  // Enseignant actif pour l'attribution et les logs
  const activeTeacher = useMemo(() => {
    try {
      const raw = localStorage.getItem('usmba_active_account');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id || parsed.enseignantId) {
          return {
            id: parsed.enseignantId || parsed.id,
            nom: parsed.nom || 'Pr. Karim El Amrani',
          };
        }
      }
    } catch {}
    return { id: enseignantId, nom: 'Pr. Karim El Amrani' };
  }, [enseignantId]);

  // Vérification de complétude
  const check = useMemo(() => dossierComplet(candidat), [candidat]);

  // Sujet de ce directeur concerné par la candidature
  const directorSujet = useMemo(() => {
    if (!candidat?.candidatures) return null;
    return allSujets.find(
      (s) => (s.enseignantId === activeTeacher.id || s.enseignantId === enseignantId) && candidat.candidatures.includes(s.id)
    ) || allSujets.find((s) => candidat.candidatures.includes(s.id)) || null;
  }, [candidat, allSujets, activeTeacher, enseignantId]);

  // Sujets choisis ordonnés : celui de ce directeur en premier
  const sujetsOrdonnes: Sujet[] = useMemo(() => {
    if (!candidat?.candidatures || candidat.candidatures.length === 0) return [];
    const candidaturesSujets = candidat.candidatures
      .map((id) => allSujets.find((s) => s.id === id))
      .filter((s): s is Sujet => Boolean(s));

    return candidaturesSujets.sort((a, b) => {
      const aIsMine = a.enseignantId === activeTeacher.id || a.enseignantId === enseignantId;
      const bIsMine = b.enseignantId === activeTeacher.id || b.enseignantId === enseignantId;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return 0;
    });
  }, [candidat, allSujets, activeTeacher, enseignantId]);

  // Récupération des pièces du candidat
  const pieces = useMemo(() => {
    return Array.isArray(candidat?.pieces) ? candidat!.pieces : [];
  }, [candidat]);

  const cinPiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
  }, [pieces]);

  const diplomePiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'DIPLOME');
  }, [pieces]);

  const relevesPiece = useMemo(() => {
    return pieces.find((p) => p && p.type && p.type.toUpperCase() === 'RELEVES');
  }, [pieces]);

  // Statuts des 3 pièces de contrôle
  const cinOk = Boolean(
    cinPiece &&
    cinPiece.statut === 'prouvee' &&
    cinPiece.fichier &&
    cinPiece.fichierVerso &&
    cinPiece.source !== 'apogee'
  );
  const diplomeOk = Boolean(
    diplomePiece && diplomePiece.statut === 'prouvee' && diplomePiece.fichier && diplomePiece.source !== 'apogee'
  );
  const relevesOk = Boolean(
    relevesPiece && relevesPiece.statut === 'prouvee' && relevesPiece.fichier && relevesPiece.source !== 'apogee'
  );

  // 5 dernières actions du journal concernant ce candidat
  const historique = useMemo(() => {
    if (!candidat) return [];
    const all = lireJournal();
    const candId = (candidat.id || '').toLowerCase();
    const candNom = (candidat.nom || '').toLowerCase();

    const matches = all.filter((e) => {
      const c = (e.cible || '').toLowerCase();
      const d = (e.detail || '').toLowerCase();
      const nom = (e.acteurNom || '').toLowerCase();
      const id = (e.acteurId || '').toLowerCase();
      return (
        (candId && (c.includes(candId) || d.includes(candId) || id === candId)) ||
        (candNom && (c.includes(candNom) || d.includes(candNom) || nom === candNom))
      );
    });

    return matches.slice(0, 5);
  }, [candidat]);

  // Action : Valider la candidature
  const hasACorriger = Object.values(candidat?.candidaturesStatuts || {}).some((s) => s === 'a_corriger');
  const hasLegacySent = Boolean(
    !hasACorriger &&
    (candidat?.envoyeLe ||
      (candidat?.candidaturesEnvoyeLe && Object.keys(candidat.candidaturesEnvoyeLe).length > 0) ||
      Object.values(candidat?.candidaturesStatuts || {}).some((s) => s === 'retenue'))
  );
  const isDossierEnvoye = Boolean(candidat?.dossier?.dateEnvoi || hasLegacySent);

  const handleValider = () => {
    if (!candidat || !check.complet || !isDossierEnvoye || !directorSujet) return;

    const updatedStatuts = {
      ...(candidat.candidaturesStatuts || {}),
      [directorSujet.id]: 'retenue' as const,
    };

    const updatedCand: Candidat = {
      ...candidat,
      candidaturesStatuts: updatedStatuts,
    };

    persistCandidate(updatedCand);
    setCandidat(updatedCand);

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      const parsed = rawSim ? JSON.parse(rawSim) : {};
      parsed[`${candidat.id}-${directorSujet.id}`] = 'retenue';
      localStorage.setItem('usmba_simulated_statuts', JSON.stringify(parsed));
    } catch {}

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      fr.journalActions.candidatureValidee,
      `${candidat.nom} (${directorSujet.titre})`
    );

    setFeedback(fr.dossierDirecteur.candidatureValideeToast);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Vérifier si la candidature est validée et si le candidat est déjà convoqué
  const isDossierValide = useMemo(() => {
    if (!candidat) return false;
    const statuts = candidat.candidaturesStatuts || {};
    if (directorSujet && statuts[directorSujet.id] === 'retenue') return true;
    if (Object.values(statuts).some((s) => s === 'retenue')) return true;
    if (directorSujet) {
      try {
        const rawSim = localStorage.getItem('usmba_simulated_statuts');
        if (rawSim) {
          const parsed = JSON.parse(rawSim);
          if (parsed[`${candidat.id}-${directorSujet.id}`] === 'retenue') return true;
        }
      } catch {}
    }
    return false;
  }, [candidat, directorSujet]);

  const existingConvocation = useMemo(() => {
    if (!candidat) return undefined;
    return creneaux.find(
      (c) => c.candidatId === candidat.id && (c.statut === 'reserve' || c.statut === 'confirme')
    );
  }, [creneaux, candidat]);

  const openConvoquerModal = () => {
    const currentCreneaux = readStoredCreneaux();
    const myCreneauxWithLieu = currentCreneaux.filter(
      (c) =>
        (c.enseignantId === activeTeacher.id || c.enseignantId === enseignantId) &&
        Boolean(c.lieu && c.lieu.trim())
    );
    const lastLieu =
      myCreneauxWithLieu.length > 0
        ? myCreneauxWithLieu[myCreneauxWithLieu.length - 1].lieu.trim()
        : '';

    setConvoquerDate('');
    setConvoquerHeure('');
    setConvoquerLieu(lastLieu);
    setShowConvoquerModal(true);
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

  const handleConvoquerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidat || !canSubmitConvoquer) return;

    const trimmedDate = convoquerDate.trim();
    const trimmedHeure = convoquerHeure.trim();
    const trimmedLieu = convoquerLieu.trim();
    const freshCreneaux = readStoredCreneaux();

    const alreadyConvoked = freshCreneaux.some(
      (c) => c.candidatId === candidat.id && (c.statut === 'reserve' || c.statut === 'confirme')
    );
    if (alreadyConvoked) {
      setCreneaux(freshCreneaux);
      setShowConvoquerModal(false);
      return;
    }

    setConvoquerSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const targetEnseignantId = activeTeacher.id || enseignantId;
      const newSlot: Creneau = {
        id: `cr-${Date.now()}`,
        enseignantId: targetEnseignantId,
        date: trimmedDate,
        heure: trimmedHeure,
        lieu: trimmedLieu,
        candidatId: candidat.id,
        statut: 'reserve',
        dateReservation: nowIso,
      };

      const nextList = [...freshCreneaux, newSlot];
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(nextList));
      setCreneaux(nextList);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      setShowConvoquerModal(false);

      const candInfo = trouverCandidat(candidat.id);
      const fullName =
        candInfo.nom ||
        (candidat.nomFamille?.trim() && candidat.prenom?.trim()
          ? `${candidat.prenom.trim()} ${candidat.nomFamille.trim()}`
          : candidat.nom?.trim()) ||
        fr.dossierDirecteur.nonRenseigne;
      const emailToUse = candInfo.email || candidat.email || '';
      const msg = messageConvocation(trimmedDate, trimmedHeure, trimmedLieu);

      ajouterNotification({
        destinataireId: candidat.id,
        texte: msg,
        type: 'action',
        actionLabel: fr.notifications.btnAllerEntretiens,
        actionTab: 'entretiens',
      });

      setFeedback(
        fr.dossierDirecteur.convocationSentFeedback
          .replace('{date}', formatDateJJMMAAAA(trimmedDate))
          .replace('{heure}', trimmedHeure)
      );
      setTimeout(() => setFeedback(null), 4000);

      const result = await sendAdmissionEmail({
        toEmail: emailToUse,
        toName: fullName,
        message: msg,
      });

      const emailSentAt = new Date().toISOString();
      const reason = result.error || fr.cedSeances.emailNetworkError;
      const latestCreneaux = readStoredCreneaux();
      const patchedCreneaux = latestCreneaux.map((c) =>
        c.id === newSlot.id
          ? {
              ...c,
              emailStatut: (result.ok ? 'envoye' : 'echec') as 'envoye' | 'echec',
              emailErreur: result.ok ? undefined : reason,
              emailEnvoyeLe: result.ok ? emailSentAt : undefined,
            }
          : c
      );
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(patchedCreneaux));
      setCreneaux(patchedCreneaux);
      window.dispatchEvent(new CustomEvent('usmba_creneaux_updated'));
      window.dispatchEvent(new CustomEvent('storage'));

      logConvocationEnvoyee(
        { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
        fullName,
        'E-mail',
        formatDateJJMMAAAA(trimmedDate),
        result.ok
          ? fr.mesCreneaux.emailSentLabel
          : `${fr.mesCreneaux.emailFailedPrefix} ${reason}`
      );
    } finally {
      setConvoquerSubmitting(false);
    }
  };

  // Action : Demander de compléter le dossier
  const handleDemanderCompleterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidat) return;

    if (demandeMotif.trim().length < 2) {
      setDemandeError(fr.sujetsModule.modalAnomalieMotifError);
      return;
    }

    const nowIso = new Date().toISOString();
    const texteManques = check.manques.length > 0 ? check.manques.join(', ') : demandePiece;
    const anomalieObj: AnomalieCandidature = {
      piece: demandePiece,
      nature: 'absente',
      motif: demandeMotif.trim(),
      le: nowIso,
    };

    const updatedPieces = pieces.map((p) => {
      if (demandePiece === 'CIN' && p.type.toUpperCase() === 'CIN') {
        return { ...p, statut: 'absente' as const };
      }
      if (demandePiece === 'DIPLOME' && p.type.toUpperCase() === 'DIPLOME') {
        return { ...p, statut: 'absente' as const };
      }
      if (demandePiece === 'RELEVES' && p.type.toUpperCase() === 'RELEVES') {
        return { ...p, statut: 'absente' as const };
      }
      return p;
    });

    const targetSujetId = directorSujet ? directorSujet.id : (candidat.candidatures?.[0] || 'suj-01');

    const updatedCand: Candidat = {
      ...candidat,
      pieces: updatedPieces,
      envoyeLe: undefined,
      candidaturesEnvoyeLe: undefined,
      dossier: {
        casParticulier: Boolean(candidat.dossier?.casParticulier),
        motif: candidat.dossier?.motif,
        motifAutre: candidat.dossier?.motifAutre,
        guichet: Boolean(candidat.dossier?.guichet),
        guichetStatut: candidat.dossier?.guichetStatut,
        journalGuichet: candidat.dossier?.journalGuichet,
        saisiPar: candidat.dossier?.saisiPar,
        saisiLe: candidat.dossier?.saisiLe,
        consentementGuichet: candidat.dossier?.consentementGuichet,
        dateEnvoi: undefined,
      },
      candidaturesStatuts: {
        ...(candidat.candidaturesStatuts || {}),
        [targetSujetId]: 'a_corriger',
      },
      candidaturesAnomalies: {
        ...(candidat.candidaturesAnomalies || {}),
        [targetSujetId]: anomalieObj,
      },
      anomalie: anomalieObj,
    };

    persistCandidate(updatedCand);
    setCandidat(updatedCand);

    try {
      const rawDossier = localStorage.getItem('usmba_doctorat_dossier');
      if (rawDossier) {
        const parsedDossier = JSON.parse(rawDossier);
        if (!parsedDossier.candidatId || parsedDossier.candidatId === candidat.id) {
          delete parsedDossier.dateEnvoi;
          localStorage.setItem('usmba_doctorat_dossier', JSON.stringify(parsedDossier));
        }
      }
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        if (cur.id === candidat.id) {
          localStorage.setItem('usmba_doctorat_pieces', JSON.stringify(updatedPieces));
        }
      }
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
      window.dispatchEvent(new CustomEvent('usmba_dossier_updated'));
    } catch {}

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      const parsed = rawSim ? JSON.parse(rawSim) : {};
      parsed[`${candidat.id}-${targetSujetId}`] = 'a_corriger';
      localStorage.setItem('usmba_simulated_statuts', JSON.stringify(parsed));
    } catch {}

    try {
      const rawNotifs = localStorage.getItem('usmba_notifications');
      const notifs: Notification[] = rawNotifs ? JSON.parse(rawNotifs) : [];
      notifs.unshift({
        id: `notif-demande-${Date.now()}`,
        destinataireId: candidat.id,
        texte: texteManques,
        date: nowIso,
        lue: false,
        type: 'action',
        actionLabel: fr.notifications.btnCompleterDossier,
        actionTab: 'dossier',
      });
      localStorage.setItem('usmba_notifications', JSON.stringify(notifs));
      window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
    } catch {}

    logEvent(
      { id: activeTeacher.id, nom: activeTeacher.nom, role: 'enseignant' },
      fr.journalActions.anomalieSignalee,
      `${candidat.nom} : ${demandePiece} - ${demandeMotif.trim()}`
    );

    setFeedback(fr.dossierDirecteur.demandeEnvoyeeToast);
    setTimeout(() => setFeedback(null), 4000);
    setShowDemandeModal(false);
    setDemandeMotif('');
    setDemandeError(null);
  };

  // Cas d'erreur : candidat introuvable
  if (!candidat) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4">
        <button
          type="button"
          onClick={onRetour}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
        >
          <ArrowLeft size={14} />
          <span>{fr.dossierDirecteur.btnRetour}</span>
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 font-medium">
          {fr.dossierDirecteur.aucuneDonnee}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-8">
      {/* a) En-tête : Bouton "← Candidatures", nom, CNE, CIN */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onRetour}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer active:scale-98"
          >
            <ArrowLeft size={15} />
            <span>{fr.dossierDirecteur.btnRetour}</span>
          </button>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Évaluation candidat
          </span>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-t border-slate-100">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {candidat.nom?.trim() || fr.dossierDirecteur.nonRenseigne}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
              <span>
                {fr.dossierDirecteur.codeMassarLabel}{' '}
                <strong className="font-mono text-slate-900">
                  {candidat.cne?.trim() || fr.dossierDirecteur.nonRenseigne}
                </strong>
              </span>
              <span>•</span>
              <span>
                {fr.dossierDirecteur.whatsappLabel}{' '}
                <strong className="font-mono text-slate-900">
                  {candidat.tel?.trim() || fr.dossierDirecteur.nonRenseigne}
                </strong>
              </span>
              <span>•</span>
              <span>
                CIN :{' '}
                <strong className="font-mono text-slate-900">
                  {candidat.cin?.trim() || fr.dossierDirecteur.nonRenseigne}
                </strong>
              </span>
            </div>
          </div>
          {isDossierEnvoye ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
              <Send size={12} />
              <span>
                {fr.dossierDirecteur.envoyeLePrefix.replace(
                  '{date}',
                  (candidat.dossier?.dateEnvoi || candidat.envoyeLe)
                    ? new Date(candidat.dossier?.dateEnvoi || candidat.envoyeLe!).toLocaleDateString('fr-FR')
                    : fr.dossierDirecteur.nonRenseigne
                )}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              <AlertCircle size={12} />
              <span>{fr.dossierDirecteur.badgeEnAttenteCandidat}</span>
            </span>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-3 text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* b) Verdict : "Dossier complet" ou "Dossier incomplet : [manques]" + Boutons */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            {check.complet ? (
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <span className="text-sm font-bold">{fr.dossierDirecteur.verdictComplet}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                <span className="text-sm font-bold">
                  {fr.dossierDirecteur.verdictIncomplet.replace('{manques}', check.manques.join(', '))}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Déjà convoqué : pastille Convoqué / Confirmé + bouton Voir la convocation */}
            {existingConvocation ? (
              <>
                {existingConvocation.statut === 'confirme' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>{fr.dossierDirecteur.badgeConfirme}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Clock size={14} className="text-amber-600 shrink-0" />
                    <span>
                      {fr.dossierDirecteur.badgeConvoqueLe
                        .replace('{date}', formatDateJJMM(existingConvocation.date))
                        .replace('{heure}', existingConvocation.heure)}
                    </span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onVoirConvocation?.()}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Calendar size={14} />
                  <span>{fr.dossierDirecteur.btnVoirConvocation}</span>
                </button>
              </>
            ) : isDossierValide ? (
              /* Dossier validé et pas encore convoqué : bouton Convoquer à la place de Valider */
              <button
                type="button"
                onClick={openConvoquerModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs active:scale-98 inline-flex items-center gap-1.5"
              >
                <Calendar size={14} />
                <span>{fr.dossierDirecteur.btnConvoquer}</span>
              </button>
            ) : check.complet && isDossierEnvoye ? (
              <button
                type="button"
                onClick={handleValider}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs active:scale-98"
              >
                {fr.dossierDirecteur.btnValider}
              </button>
            ) : (
              <button
                type="button"
                disabled
                title={
                  !check.complet
                    ? fr.dossierDirecteur.btnValiderIncomplet.replace('{manques}', check.manques.join(', '))
                    : fr.dossierDirecteur.enAttenteEnvoiRaison
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              >
                {!check.complet
                  ? fr.dossierDirecteur.btnValiderIncomplet.replace('{manques}', check.manques.join(', '))
                  : fr.dossierDirecteur.enAttenteEnvoiRaison}
              </button>
            )}

            {/* Bouton Demander de compléter */}
            <button
              type="button"
              onClick={() => {
                const firstManque = check.manques[0];
                if (firstManque === 'Diplôme') setDemandePiece('DIPLOME');
                else if (firstManque === 'Relevés') setDemandePiece('RELEVES');
                else setDemandePiece('CIN');
                setShowDemandeModal(true);
                setDemandeMotif(check.manques.length > 0 ? check.manques.join(', ') : '');
                setDemandeError(null);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer shadow-xs active:scale-98 flex items-center gap-1.5"
            >
              <AlertTriangle size={14} />
              <span>{fr.dossierDirecteur.btnDemanderCompleter}</span>
            </button>
          </div>
        </div>
      </div>

      {/* c) Contrôle : 3 lignes CIN, Diplôme, Relevés */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.controleTitre}
        </h2>

        <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50/50">
          {/* Ligne 1 : CIN */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {cinOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.cin}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    cinOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {cinOk
                    ? fr.dossierDirecteur.statutPreuveFournie
                    : cinPiece?.fichier && !cinPiece?.fichierVerso
                    ? fr.dossierDirecteur.statutVersoManquant
                    : !cinPiece?.fichier && cinPiece?.fichierVerso
                    ? fr.dossierDirecteur.statutRectoManquant
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {cinPiece?.fichier ? (
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: `${fr.dossierDirecteur.cin} — ${fr.dossier.cinRectoLabel}`,
                      fichier: cinPiece.fichier!,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
                >
                  <Eye size={13} className="text-slate-500" />
                  <span>{fr.dossierDirecteur.btnVoirRecto}</span>
                </button>
              ) : null}
              {cinPiece?.fichierVerso ? (
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: `${fr.dossierDirecteur.cin} — ${fr.dossier.cinVersoLabel}`,
                      fichier: cinPiece.fichierVerso!,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
                >
                  <Eye size={13} className="text-slate-500" />
                  <span>{fr.dossierDirecteur.btnVoirVerso}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Ligne 2 : Diplôme */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {diplomeOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.diplome}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    diplomeOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {diplomeOk
                    ? fr.dossierDirecteur.statutPreuveFournie
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            {diplomePiece?.fichier ? (
              <button
                type="button"
                onClick={() => {
                  setPieceIllisible(false);
                  setViewingPiece({
                    titre: fr.dossierDirecteur.diplome,
                    fichier: diplomePiece.fichier!,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
              >
                <Eye size={13} className="text-slate-500" />
                <span>{fr.dossierDirecteur.btnVoir}</span>
              </button>
            ) : null}
          </div>

          {/* Ligne 3 : Relevés */}
          <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {relevesOk ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <XCircle size={18} className="text-rose-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  {fr.dossierDirecteur.releves}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    relevesOk ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {relevesOk
                    ? fr.dossierDirecteur.statutPreuveFournie
                    : fr.dossierDirecteur.statutManquante}
                </span>
              </div>
            </div>

            {relevesPiece?.fichier ? (
              <button
                type="button"
                onClick={() => {
                  setPieceIllisible(false);
                  setViewingPiece({
                    titre: fr.dossierDirecteur.releves,
                    fichier: relevesPiece.fichier!,
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-98 shrink-0"
              >
                <Eye size={13} className="text-slate-500" />
                <span>{fr.dossierDirecteur.btnVoir}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* d) Cursus : diplômes et relevés en liste simple, si présents */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.cursusTitre}
        </h2>

        {candidat.cursus || diplomePiece?.fichier || relevesPiece?.fichier || candidat.dossier?.casParticulier ? (
          <ul className="space-y-2 text-xs text-slate-800">
            {candidat.cursus?.diplome && (
              <li className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <GraduationCap size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{candidat.cursus.diplome}</span>
                  {(candidat.cursus.etablissement || candidat.cursus.anneeObtention || candidat.cursus.mention) && (
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {[
                        candidat.cursus.etablissement,
                        candidat.cursus.anneeObtention ? `Promotion ${candidat.cursus.anneeObtention}` : null,
                        candidat.cursus.mention ? `Mention ${candidat.cursus.mention}` : null,
                      ]
                        .filter(Boolean)
                        .join(' — ')}
                    </p>
                  )}
                </div>
              </li>
            )}

            {diplomePiece?.fichier && !candidat.cursus?.diplome && (
              <li className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-slate-500 shrink-0" />
                  <span>Dernier diplôme fourni</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: 'Dernier diplôme',
                      fichier: diplomePiece.fichier!,
                    });
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  {fr.dossierDirecteur.btnVoir}
                </button>
              </li>
            )}

            {relevesPiece?.fichier && (
              <li className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-slate-500 shrink-0" />
                  <span>Relevés de notes universitaires</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPieceIllisible(false);
                    setViewingPiece({
                      titre: 'Relevés de notes',
                      fichier: relevesPiece.fichier!,
                    });
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  {fr.dossierDirecteur.btnVoir}
                </button>
              </li>
            )}

            {candidat.dossier?.casParticulier && (
              <li className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200/60 text-purple-900">
                <AlertCircle size={15} className="text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Cas particulier déclaré : </span>
                  <span>{candidat.dossier.motifAutre || candidat.dossier.motif || 'Dérogatoire'}</span>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* e) Candidature : les 3 sujets choisis, celui de ce directeur en premier */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.candidaturesTitre}
        </h2>

        {sujetsOrdonnes.length > 0 ? (
          <div className="space-y-2.5">
            {sujetsOrdonnes.map((s, index) => {
              const isMine = s.enseignantId === activeTeacher.id || s.enseignantId === enseignantId;
              const statut = candidat.candidaturesStatuts?.[s.id] || 'deposee';

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isMine
                      ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300/40'
                      : 'bg-slate-50/60 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Choix {index + 1}
                        </span>
                        {isMine && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                            Votre sujet
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                        {s.titre}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {s.structure}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                        statut === 'retenue'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : statut === 'a_corriger'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {statut === 'retenue'
                        ? 'Validée'
                        : statut === 'a_corriger'
                        ? 'À corriger'
                        : 'Déposée'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* f) Historique : 5 dernières actions du journal concernant ce candidat (date, action) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {fr.dossierDirecteur.historiqueTitre}
        </h2>

        {historique.length > 0 ? (
          <div className="divide-y divide-slate-100 border border-slate-200/70 rounded-xl overflow-hidden bg-slate-50/40">
            {historique.map((evt) => {
              const formattedDate = new Date(evt.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={evt.id} className="p-3 flex items-start justify-between gap-3 text-xs bg-white">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block truncate">{evt.action}</span>
                    {evt.detail && <span className="text-[11px] text-slate-500 block truncate">{evt.detail}</span>}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{formattedDate}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic p-2">{fr.dossierDirecteur.aucuneDonnee}</p>
        )}
      </div>

      {/* 3. Aperçu pièce plein écran */}
      {viewingPiece && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">{viewingPiece.titre}</h3>
              {isPdfData(viewingPiece.fichier) && (
                <button
                  type="button"
                  onClick={() => openPdfInNewTab(viewingPiece.fichier)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <ExternalLink size={13} />
                  <span>{fr.dossierDirecteur.ouvrirNouvelOnglet}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setViewingPiece(null);
                setPieceIllisible(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-2"
              aria-label={fr.dossierDirecteur.fermerApercu}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
            {pieceIllisible ? (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-rose-400 font-medium border border-rose-950">
                <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
                <p>{fr.dossierDirecteur.fichierIllisible}</p>
              </div>
            ) : isPdfData(viewingPiece.fichier) ? (
              <iframe
                src={viewingPiece.fichier}
                title={viewingPiece.titre}
                className="w-full h-full min-h-[75vh] rounded-xl bg-white border border-slate-800 shadow-xl"
                onError={() => setPieceIllisible(true)}
              />
            ) : isImageData(viewingPiece.fichier) ? (
              <img
                src={viewingPiece.fichier}
                alt={viewingPiece.titre}
                onError={() => setPieceIllisible(true)}
                className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-xl bg-slate-900"
              />
            ) : (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-rose-400 font-medium border border-rose-950">
                <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
                <p>{fr.dossierDirecteur.fichierIllisible}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale "Demander de compléter" */}
      {showDemandeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {fr.dossierDirecteur.modalDemandeTitre}
                </h3>
                <p className="text-xs text-slate-500">
                  {fr.dossierDirecteur.modalDemandeDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemandeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDemanderCompleterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.pieceACompleter}
                </label>
                <select
                  value={demandePiece}
                  onChange={(e) => setDemandePiece(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="CIN">{fr.dossierDirecteur.cin}</option>
                  <option value="DIPLOME">{fr.dossierDirecteur.diplome}</option>
                  <option value="RELEVES">{fr.dossierDirecteur.releves}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.motifLabel}
                </label>
                <textarea
                  value={demandeMotif}
                  onChange={(e) => {
                    setDemandeMotif(e.target.value);
                    setDemandeError(null);
                  }}
                  rows={3}
                  placeholder={fr.dossierDirecteur.motifPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                {demandeError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1">
                    {demandeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemandeModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  {fr.dossierDirecteur.btnAnnuler}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={13} />
                  <span>{fr.dossierDirecteur.btnEnvoyerDemande}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale "Convoquer" */}
      {showConvoquerModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowConvoquerModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="convoquer-modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar size={18} className="text-emerald-700 shrink-0" />
                <h3 id="convoquer-modal-title" className="text-sm font-bold text-slate-900 truncate">
                  {fr.dossierDirecteur.modalConvoquerTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConvoquerModal(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X size={14} />
                <span>{fr.dossierDirecteur.convoquerFermer}</span>
              </button>
            </div>

            <form onSubmit={handleConvoquerSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="convoquer-date" className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.convoquerDateLabel}
                </label>
                <input
                  id="convoquer-date"
                  type="date"
                  min={todayDateStr}
                  value={convoquerDate}
                  onChange={(e) => setConvoquerDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="convoquer-heure" className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.convoquerHeureLabel}
                </label>
                <input
                  id="convoquer-heure"
                  type="time"
                  value={convoquerHeure}
                  onChange={(e) => setConvoquerHeure(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="convoquer-lieu" className="block text-xs font-bold text-slate-700 mb-1">
                  {fr.dossierDirecteur.convoquerLieuLabel}
                </label>
                <input
                  id="convoquer-lieu"
                  type="text"
                  value={convoquerLieu}
                  onChange={(e) => setConvoquerLieu(e.target.value)}
                  placeholder={fr.dossierDirecteur.convoquerLieuPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConvoquerModal(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                  >
                    {fr.dossierDirecteur.btnAnnuler}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmitConvoquer}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                      canSubmitConvoquer
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Calendar size={13} />
                    <span>{fr.dossierDirecteur.btnConvoquer}</span>
                  </button>
                </div>
                {convoquerDisabledReason && (
                  <p className="text-[11px] font-medium text-slate-500 text-right">
                    {convoquerDisabledReason}
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
