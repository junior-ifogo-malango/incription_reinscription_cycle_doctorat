import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Upload, FileText, CheckCircle2, AlertCircle, X, Eye, RotateCcw, Award, AlertTriangle, Info, Loader2, Pencil, Send, ArrowLeft } from 'lucide-react';
import { Piece, PieceType, PieceSource, Candidat, MotifCasParticulier, PV, dossierComplet, AnomalieCandidature, CandidatureStatut } from '../types';
import { ApogeeFictif, MOCK_CANDIDATS } from '../data/mockData';
import { storageService } from '../services/storage';
import { CameraCapture } from './CameraCapture';
import { fr } from '../i18n/fr';
import { logCandidatureEnvoyee } from '../utils/journal';
import {
  normaliserTel,
  notifierDirecteurCandidatureEnvoyee,
  reconcileCandidateFromStorage,
  persistUnifiedCandidate,
} from '../utils/messages';
import { lireCinDeuxFaces, prechargerOcrCin, CinOcrOptions, CinOcrFields } from '../utils/ocrCin';
import { ProgressionCandidat } from './ProgressionCandidat';

function formatDateJJMMAAAA(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const jj = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aaaa = d.getFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

function findCandidateById(id?: string): Candidat | null {
  if (!id) return null;
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (overrides[id]) return reconcileCandidateFromStorage(overrides[id]);
    }
  } catch {}
  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.id === id) return reconcileCandidateFromStorage(cur);
    }
  } catch {}
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      const found = accounts.find((a) => a.id === id);
      if (found) return reconcileCandidateFromStorage(found);
    }
  } catch {}
  const mock = MOCK_CANDIDATS.find((c) => c.id === id);
  if (mock) return reconcileCandidateFromStorage(mock);
  return null;
}

function persistCandidate(cand: Candidat): void {
  persistUnifiedCandidate(cand, true);
}

function resolveCandidate(candidatId?: string, fallback?: Candidat | null): Candidat {
  if (candidatId) {
    const found = findCandidateById(candidatId);
    if (found) return found;
  }
  try {
    const raw = localStorage.getItem('usmba_doctorat_candidat');
    if (raw) return reconcileCandidateFromStorage(JSON.parse(raw));
  } catch {}
  return fallback ? reconcileCandidateFromStorage(fallback) : {
    id: 'visiteur-001',
    nom: '',
    cne: '',
    cin: '',
    email: '',
    tel: '',
    panier: [],
    candidatures: [],
    compteCree: false,
  };
}

const ORDERED_TYPES: PieceType[] = ['CIN', 'DIPLOME', 'RELEVES'];

const compressImageDataUrl = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > 800) {
        height = Math.round((height * 800) / width);
        width = 800;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const YASSINE_INITIAL_PIECES: Piece[] = [
  {
    type: 'CIN',
    statut: 'declaree',
  },
  {
    type: 'DIPLOME',
    statut: 'declaree',
  },
  {
    type: 'RELEVES',
    statut: 'declaree',
  },
];

const DEFAULT_PIECES: Piece[] = [
  { type: 'CIN', statut: 'absente' },
  { type: 'DIPLOME', statut: 'absente' },
  { type: 'RELEVES', statut: 'absente' },
];

interface DossierProps {
  candidatId?: string;
  onNavigate?: (tab: any) => void;
}

export const Dossier: React.FC<DossierProps> = ({ candidatId, onNavigate }) => {
  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [activeCameraTarget, setActiveCameraTarget] = useState<{
    type: PieceType;
    side?: 'recto' | 'verso';
    dual?: boolean;
  } | null>(null);
  const [cinUploadSplitOpen, setCinUploadSplitOpen] = useState<boolean>(false);
  const [cinRectoUploadError, setCinRectoUploadError] = useState<string | null>(null);
  const [cinVersoUploadError, setCinVersoUploadError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null);
  const [apogeeCne, setApogeeCne] = useState<string>('');
  const [apogeeConsent, setApogeeConsent] = useState<boolean>(false);
  const [apogeeMessage, setApogeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cinFormNom, setCinFormNom] = useState<string>('');
  const [cinFormPrenom, setCinFormPrenom] = useState<string>('');
  const [cinFormNumero, setCinFormNumero] = useState<string>('');
  const [cinFormDateNaissance, setCinFormDateNaissance] = useState<string>('');
  const [cinFormTouched, setCinFormTouched] = useState<{
    nom?: boolean;
    prenom?: boolean;
    cin?: boolean;
    dateNaissance?: boolean;
  }>({});
  const [cinVerifySaved, setCinVerifySaved] = useState<boolean>(false);
  const [cinOcrStatus, setCinOcrStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [autoOcrCamera, setAutoOcrCamera] = useState<boolean>(true);
  const [massarInput, setMassarInput] = useState<string>('');
  const [whatsappInput, setWhatsappInput] = useState<string>('');
  const [massarError, setMassarError] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [infosSaved, setInfosSaved] = useState<boolean>(false);
  const [provenCinRectoImgError, setProvenCinRectoImgError] = useState<boolean>(false);
  const [provenCinVersoImgError, setProvenCinVersoImgError] = useState<boolean>(false);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [viewingPiece, setViewingPiece] = useState<{ piece: Piece; side?: 'recto' | 'verso' } | null>(null);
  const [isCinEditing, setIsCinEditing] = useState<boolean>(false);
  const [cinVerifyModalOpen, setCinVerifyModalOpen] = useState<boolean>(false);
  const [confirmEnvoiOpen, setConfirmEnvoiOpen] = useState<boolean>(false);

  // Cas particulier state
  const [casParticulier, setCasParticulier] = useState<boolean>(false);
  const [motif, setMotif] = useState<MotifCasParticulier | ''>('');
  const [motifAutre, setMotifAutre] = useState<string>('');
  const [saveCasSuccess, setSaveCasSuccess] = useState<boolean>(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const ocrRunIdRef = useRef<number>(0);
  const ocrFilledFieldsRef = useRef<{
    nom?: boolean;
    prenom?: boolean;
    cin?: boolean;
    dateNaissance?: boolean;
  }>({});
  const loadedCandidatIdRef = useRef<string | null>(null);

  // Fermeture de l'aperçu de pièce, modale CIN ou confirmation d'envoi par la touche Échap
  useEffect(() => {
    if (!viewingPiece && !confirmEnvoiOpen && !cinVerifyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingPiece) setViewingPiece(null);
        if (confirmEnvoiOpen) setConfirmEnvoiOpen(false);
        if (cinVerifyModalOpen) setCinVerifyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPiece, confirmEnvoiOpen, cinVerifyModalOpen]);

  // Charger le candidat et ses données depuis le localStorage ou via candidatId
  useEffect(() => {
    const loadData = () => {
      try {
        let parsed: Candidat | null = null;
        if (candidatId) {
          parsed = findCandidateById(candidatId);
        }
        if (!parsed) {
          const raw = localStorage.getItem('usmba_doctorat_candidat');
          if (raw) {
            parsed = JSON.parse(raw);
          }
        }
        if (parsed) {
          parsed = reconcileCandidateFromStorage(parsed);
          if (!candidatId && parsed.compteCree) {
            localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(parsed));
          }
        }

        if (parsed) {
          setCandidat(parsed);
          const isNewCandidate = loadedCandidatIdRef.current !== parsed.id;
          loadedCandidatIdRef.current = parsed.id;
          if (isNewCandidate) {
            ocrFilledFieldsRef.current = {};
            setCinFormNom(parsed.nomFamille || '');
            setCinFormPrenom(parsed.prenom || '');
            setCinFormNumero(parsed.cin || '');
            setCinFormDateNaissance(parsed.dateNaissance || '');
          } else {
            setCinFormNom((prev) => (prev.trim() ? prev : parsed!.nomFamille || ''));
            setCinFormPrenom((prev) => (prev.trim() ? prev : parsed!.prenom || ''));
            setCinFormNumero((prev) => (prev.trim() ? prev : parsed!.cin || ''));
            setCinFormDateNaissance((prev) => (prev.trim() ? prev : parsed!.dateNaissance || ''));
          }
          setMassarInput(parsed.cne || '');
          setWhatsappInput(parsed.tel || '');
          if (parsed.cne) {
            setApogeeCne(parsed.cne);
          }
          if (parsed.dossier) {
            setCasParticulier(Boolean(parsed.dossier.casParticulier));
            setMotif(parsed.dossier.motif || '');
            setMotifAutre(parsed.dossier.motifAutre || '');
          }

          // Si parsed.pieces existe
          if (parsed.pieces && Array.isArray(parsed.pieces) && parsed.pieces.length > 0) {
            const normalized = ORDERED_TYPES.map((t) => {
              const found = parsed!.pieces!.find(
                (p) => p.type.toUpperCase() === t.toUpperCase()
              );
              return found ? { ...found, type: t } : { type: t, statut: 'absente' as const };
            });
            setPieces(normalized);
          } else if (candidatId) {
            setPieces(DEFAULT_PIECES);
          } else {
            let restoredPieces: Piece[] | null = null;
            try {
              const rawDossier = localStorage.getItem('usmba_doctorat_dossier');
              const rawPieces = localStorage.getItem('usmba_doctorat_pieces');
              if (rawDossier && rawPieces) {
                const storedDossier = JSON.parse(rawDossier);
                const storedPieces: Piece[] = JSON.parse(rawPieces);
                if (
                  storedDossier?.candidatId === parsed.id &&
                  Array.isArray(storedPieces) &&
                  storedPieces.length > 0
                ) {
                  restoredPieces = ORDERED_TYPES.map((t) => {
                    const found = storedPieces.find(
                      (p) => p.type.toUpperCase() === t.toUpperCase()
                    );
                    return found ? { ...found, type: t } : { type: t, statut: 'absente' as const };
                  });
                }
              }
            } catch {}
            setPieces(restoredPieces || DEFAULT_PIECES);
          }
        } else {
          // Fallback depuis usmba_doctorat_pieces
          const rawPieces = localStorage.getItem('usmba_doctorat_pieces');
          if (rawPieces) {
            const storedPieces: Piece[] = JSON.parse(rawPieces);
            if (Array.isArray(storedPieces) && storedPieces.length > 0) {
              const normalized = ORDERED_TYPES.map((t) => {
                const found = storedPieces.find(
                  (p) => p.type.toUpperCase() === t.toUpperCase()
                );
                return found ? { ...found, type: t } : { type: t, statut: 'absente' as const };
              });
              setPieces(normalized);
            }
          } else {
            // Si c'est le profil démo Yassine initial
            const initialList = YASSINE_INITIAL_PIECES;
            localStorage.setItem('usmba_doctorat_pieces', JSON.stringify(initialList));
            setPieces(initialList);
          }
        }
      } catch {
        // safe fallback
      }

      try {
        const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
        if (rawPvs) {
          setPvs(JSON.parse(rawPvs));
        } else {
          setPvs([]);
        }
      } catch {
        setPvs([]);
      }
    };

    loadData();
    window.addEventListener('usmba_pvs_updated', loadData);
    window.addEventListener('usmba_pieces_updated', loadData);
    window.addEventListener('usmba_candidat_updated', loadData);
    window.addEventListener('usmba_dossier_updated', loadData);
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('usmba_pvs_updated', loadData);
      window.removeEventListener('usmba_pieces_updated', loadData);
      window.removeEventListener('usmba_candidat_updated', loadData);
      window.removeEventListener('usmba_dossier_updated', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, [candidatId]);

  // PVs actifs publiés et non remplacés
  const activePublishedPvs = pvs.filter((pv) => Boolean(pv.publieLe) && !pv.remplaceePar);
  const candidatResultat = activePublishedPvs
    .flatMap((pv) => pv.resultats || [])
    .find(
      (r) =>
        r.candidatId === candidat?.id ||
        (candidat?.id === 'cand-001' && r.candidatId === 'cand-001')
    );

  // 2. peutProuver = le candidat a au moins une candidature de statut 'retenue' (libellé « Validée »),
  // OU un PV non remplacé, publié, contient un Resultat ADMIS pour lui,
  // OU l'agent est en train de traiter le dossier au guichet.
  const hasRetenueCandidature = Boolean(
    candidat?.candidaturesStatuts &&
    Object.values(candidat.candidaturesStatuts).some((s) => s === 'retenue')
  );
  const isAdmisPv = candidatResultat?.resultat === 'ADMIS';
  const isAgentMode = Boolean(candidatId);
  const peutProuver = hasRetenueCandidature || isAdmisPv || isAgentMode;

  const candidatures = candidat?.candidatures || [];
  const statuts = candidat?.candidaturesStatuts || {};
  const hasACorriger = candidatures.some((id) => statuts[id] === 'a_corriger');

  // Anomalie active éventuelle
  const activeAnomalie: AnomalieCandidature | undefined =
    candidat?.anomalie ||
    (candidat?.candidaturesAnomalies && Object.values(candidat.candidaturesAnomalies)[0]);

  const [transmissionSuccess, setTransmissionSuccess] = useState<string | null>(null);

  const isDirecteur = Boolean(
    storageService.getRole() === 'enseignant' ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('usmba_doctorat_role') === 'enseignant')
  );

  const handleConfirmEnvoyerDossier = () => {
    const cur = resolveCandidate(candidatId, candidat);
    const curHasACorriger = (cur.candidatures || []).some(
      (id) => cur.candidaturesStatuts?.[id] === 'a_corriger'
    );
    if (cur.dossier?.dateEnvoi && !curHasACorriger) return;
    const check = dossierComplet(cur);
    const hasThreeSubjectsCur = Array.isArray(cur.candidatures) && cur.candidatures.length >= 3;
    const cinOk = Boolean(
      cur.nomFamille?.trim() &&
      cur.prenom?.trim() &&
      cur.cin?.trim() &&
      /^[A-Za-z]{1,2}[0-9]{5,6}$/.test(cur.cin.trim()) &&
      cur.dateNaissance?.trim()
    );
    const massarOk = Boolean(cur.cne?.trim() && /^[A-Za-z][0-9]{9}$/.test(cur.cne.trim()));
    const whatsappOk = Boolean(cur.tel?.trim() && normaliserTel(cur.tel.trim()));
    if (!hasThreeSubjectsCur || !check.complet || !cinOk || !massarOk || !whatsappOk) return;

    const nowIso = new Date().toISOString();
    const updatedStatuts: Record<string, CandidatureStatut> = {
      ...(cur.candidaturesStatuts || {}),
    };
    const updatedEnvoyeLe: Record<string, string> = {
      ...(cur.candidaturesEnvoyeLe || {}),
    };

    (cur.candidatures || []).forEach((id) => {
      const st = updatedStatuts[id];
      if (!st || st === 'brouillon' || st === 'a_corriger') {
        updatedStatuts[id] = 'deposee';
        updatedEnvoyeLe[id] = nowIso;
      }
    });

    cur.candidaturesStatuts = updatedStatuts;
    cur.candidaturesEnvoyeLe = updatedEnvoyeLe;
    cur.envoyeLe = cur.envoyeLe || nowIso;
    cur.anomalie = undefined;
    cur.candidaturesAnomalies = undefined;
    cur.dossier = {
      casParticulier: Boolean(cur.dossier?.casParticulier),
      motif: cur.dossier?.motif,
      motifAutre: cur.dossier?.motifAutre,
      guichet: Boolean(cur.dossier?.guichet),
      guichetStatut: cur.dossier?.guichetStatut,
      journalGuichet: cur.dossier?.journalGuichet,
      saisiPar: cur.dossier?.saisiPar,
      saisiLe: cur.dossier?.saisiLe,
      consentementGuichet: cur.dossier?.consentementGuichet,
      dateEnvoi: nowIso,
    };

    persistCandidate(cur);
    setCandidat({ ...cur });
    setIsCinEditing(false);
    setConfirmEnvoiOpen(false);

    try {
      const rawSim = localStorage.getItem('usmba_simulated_statuts');
      if (rawSim) {
        const simParsed = JSON.parse(rawSim);
        let simChanged = false;
        (cur.candidatures || []).forEach((sId) => {
          const k = `${cur.id}-${sId}`;
          if (simParsed[k] === 'a_corriger') {
            simParsed[k] = 'deposee';
            simChanged = true;
          }
        });
        if (simChanged) {
          localStorage.setItem('usmba_simulated_statuts', JSON.stringify(simParsed));
        }
      }
    } catch {}

    try {
      const rawDossier = localStorage.getItem('usmba_doctorat_dossier');
      if (rawDossier) {
        const parsedDossier = JSON.parse(rawDossier);
        if (!parsedDossier.candidatId || parsedDossier.candidatId === cur.id) {
          parsedDossier.dateEnvoi = nowIso;
          localStorage.setItem('usmba_doctorat_dossier', JSON.stringify(parsedDossier));
        }
      }
    } catch {}

    try {
      const rawSujets = localStorage.getItem('usmba_doctorat_sujets');
      const allSujets = rawSujets ? JSON.parse(rawSujets) : [];
      const teacherIds: string[] = [];
      (cur.candidatures || []).forEach((sId) => {
        const s = allSujets.find((x: any) => x.id === sId);
        if (s?.enseignantId) teacherIds.push(s.enseignantId);
      });
      notifierDirecteurCandidatureEnvoyee(
        teacherIds,
        fr.dossier.notifCandidatureEnvoyee.replace('{nom}', cur.nom || 'un candidat')
      );
    } catch {}

    logCandidatureEnvoyee(
      { id: cur.id, nom: cur.nom || cur.email || 'Candidat', role: 'candidat' },
      cur.nom || cur.id,
      formatDateJJMMAAAA(nowIso)
    );

    window.dispatchEvent(new CustomEvent('usmba_candidat_updated', { detail: cur }));
    window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
    window.dispatchEvent(new CustomEvent('usmba_dossier_updated'));

    setTransmissionSuccess(
      curHasACorriger ? fr.dossier.candidatureRenvoyeeSucces : fr.dossier.candidatureEnvoyeeSucces
    );
    setTimeout(() => setTransmissionSuccess(null), 5000);
  };

  const savePieces = (updatedPieces: Piece[]): boolean => {
    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.pieces = updatedPieces;
      persistCandidate(curCandidat);

      if (!candidatId || candidatId === curCandidat.id) {
        localStorage.setItem('usmba_doctorat_pieces', JSON.stringify(updatedPieces));
      }

      setPieces(updatedPieces);
      setCandidat(curCandidat);
      setFeedbackMessage(null);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated', { detail: updatedPieces }));
      return true;
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        err?.message?.toLowerCase().includes('quota');

      if (isQuota) {
        setFeedbackMessage({
          type: 'error',
          text: fr.dossier.quotaExceededSupprime,
        });
      }
      return false;
    }
  };

  const handleUpdatePiece = (
    type: PieceType,
    updates: Partial<Piece>
  ) => {
    const currentList =
      pieces.length === ORDERED_TYPES.length
        ? pieces
        : ORDERED_TYPES.map((t) => {
            const found = pieces.find((p) => p.type.toUpperCase() === t.toUpperCase());
            return found || { type: t, statut: 'absente' as const };
          });

    const nowIso = new Date().toISOString();
    const updated = currentList.map((p) => {
      if (p.type.toUpperCase() === type.toUpperCase()) {
        return {
          ...p,
          ...updates,
          type,
          dateMaj: updates.dateMaj || nowIso,
        };
      }
      return p;
    });
    savePieces(updated);
  };

  const handleUpdateCinSide = (
    side: 'recto' | 'verso',
    fichier: string | undefined,
    source: PieceSource | undefined
  ) => {
    const currentList =
      pieces.length === ORDERED_TYPES.length
        ? pieces
        : ORDERED_TYPES.map((t) => {
            const found = pieces.find((p) => p.type.toUpperCase() === t.toUpperCase());
            return found || { type: t, statut: 'absente' as const };
          });

    const nowIso = new Date().toISOString();
    const updated = currentList.map((p) => {
      if (p.type.toUpperCase() === 'CIN') {
        const nextRecto = side === 'recto' ? fichier : p.fichier;
        const nextSourceRecto = side === 'recto' ? source : p.source;
        const nextVerso = side === 'verso' ? fichier : p.fichierVerso;
        const nextSourceVerso = side === 'verso' ? source : p.sourceVerso;
        const hasRecto = Boolean(nextRecto && nextRecto.trim() !== '');
        const hasVerso = Boolean(nextVerso && nextVerso.trim() !== '');
        const nextStatut =
          hasRecto && hasVerso
            ? ('prouvee' as const)
            : hasRecto || hasVerso
            ? ('declaree' as const)
            : ('absente' as const);

        return {
          ...p,
          type: 'CIN' as const,
          statut: nextStatut,
          dateMaj: nowIso,
          fichier: nextRecto,
          source: nextSourceRecto,
          fichierVerso: nextVerso,
          sourceVerso: nextSourceVerso,
          ocrResultat: undefined,
        };
      }
      return p;
    });
    savePieces(updated);
  };

  const validateDateNaissance = (val: string): string | null => {
    const clean = val.trim();
    if (!clean) return fr.dossier.dateNaissanceObligatoire;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
    if (!match) return fr.dossier.dateNaissanceInvalide;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
      return fr.dossier.dateNaissanceInvalide;
    }
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return fr.dossier.dateNaissanceInvalide;
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const birthStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (birthStr > todayStr) {
      return fr.dossier.dateNaissanceFuture;
    }
    return null;
  };

  const cinFormErrors = {
    nom: !cinFormNom.trim() ? fr.dossier.nomObligatoire : null,
    prenom: !cinFormPrenom.trim() ? fr.dossier.prenomObligatoire : null,
    cin: !cinFormNumero.trim()
      ? fr.dossier.cinObligatoire
      : !/^[A-Za-z]{1,2}[0-9]{5,6}$/.test(cinFormNumero.trim())
      ? fr.dossier.cinFormatError
      : null,
    dateNaissance: validateDateNaissance(cinFormDateNaissance),
  };

  const isCinFormValid =
    !cinFormErrors.nom &&
    !cinFormErrors.prenom &&
    !cinFormErrors.cin &&
    !cinFormErrors.dateNaissance;
  const hasCinVersoUploaded = Boolean(
    pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN')?.fichierVerso
  );
  const canSaveCinForm = isCinFormValid && hasCinVersoUploaded;

  const openCinVerifyForm = () => {
    const curCandidat = resolveCandidate(candidatId, candidat);
    setCinFormNom((prev) => (prev.trim() ? prev : curCandidat.nomFamille || ''));
    setCinFormPrenom((prev) => (prev.trim() ? prev : curCandidat.prenom || ''));
    setCinFormNumero((prev) => (prev.trim() ? prev : curCandidat.cin || ''));
    setCinFormDateNaissance((prev) => (prev.trim() ? prev : curCandidat.dateNaissance || ''));
    setCinFormTouched({});
    setCinVerifySaved(false);
  };

  const runCinOcr = async (
    rectoSource?: string,
    versoSource?: string,
    options?: CinOcrOptions
  ) => {
    const runId = ++ocrRunIdRef.current;
    setCinOcrStatus('loading');
    const ocrResult = await lireCinDeuxFaces(rectoSource, versoSource, options);
    if (runId !== ocrRunIdRef.current) return;

    if (!ocrResult.success) {
      setCinOcrStatus('error');
      return;
    }

    const { nom, prenom, cin, dateNaissance } = ocrResult.fields;

    if (nom) {
      setCinFormNom((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.nom) return prev;
        ocrFilledFieldsRef.current.nom = true;
        return nom;
      });
    }
    if (prenom) {
      setCinFormPrenom((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.prenom) return prev;
        ocrFilledFieldsRef.current.prenom = true;
        return prenom;
      });
    }
    if (cin) {
      setCinFormNumero((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.cin) return prev;
        ocrFilledFieldsRef.current.cin = true;
        return cin;
      });
    }
    if (dateNaissance) {
      setCinFormDateNaissance((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.dateNaissance) return prev;
        ocrFilledFieldsRef.current.dateNaissance = true;
        return dateNaissance;
      });
    }

    setCinOcrStatus('success');
  };

  const handleSaveVosInfos = (e: React.FormEvent) => {
    e.preventDefault();
    setCinFormTouched({
      nom: true,
      prenom: true,
      cin: true,
      dateNaissance: true,
    });
    if (!canSaveCinForm) return;

    const cleanNom = cinFormNom.trim();
    const cleanPrenom = cinFormPrenom.trim();
    const cleanCin = cinFormNumero.trim().toUpperCase();
    const cleanDate = cinFormDateNaissance.trim();

    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.nomFamille = cleanNom;
      curCandidat.prenom = cleanPrenom;
      curCandidat.nom = `${cleanPrenom} ${cleanNom}`.trim();
      curCandidat.cin = cleanCin;
      curCandidat.dateNaissance = cleanDate;
      persistCandidate(curCandidat);
      setCandidat({ ...curCandidat });
      setCinFormNumero(cleanCin);

      const rawAcc = localStorage.getItem('usmba_active_account');
      if (rawAcc) {
        const acc = JSON.parse(rawAcc);
        if (acc && (!acc.email || !curCandidat.email || acc.email.toLowerCase() === curCandidat.email.toLowerCase())) {
          acc.nomFamille = cleanNom;
          acc.prenom = cleanPrenom;
          acc.nom = curCandidat.nom;
          acc.cin = cleanCin;
          acc.dateNaissance = cleanDate;
          localStorage.setItem('usmba_active_account', JSON.stringify(acc));
          window.dispatchEvent(new CustomEvent('usmba_account_updated'));
        }
      }

      setCinVerifySaved(true);
      setIsCinEditing(false);
      setCinVerifyModalOpen(false);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
      setTimeout(() => {
        setCinVerifySaved(false);
      }, 2500);
    } catch {
      // safe fallback
    }
  };

  const cleanMassarInput = massarInput.trim().toUpperCase();
  const cleanWhatsappInput = whatsappInput.trim();
  const isMassarInputValid = Boolean(cleanMassarInput && /^[A-Z][0-9]{9}$/.test(cleanMassarInput));
  const isWhatsappInputValid = Boolean(cleanWhatsappInput && normaliserTel(cleanWhatsappInput));
  const isInfosCandidatFormValid = isMassarInputValid && isWhatsappInputValid;

  const handleSaveInfosCandidat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMassar = massarInput.trim().toUpperCase();
    const cleanWhatsapp = whatsappInput.trim();

    let hasErr = false;
    if (!cleanMassar) {
      setMassarError(fr.dossier.codeMassarRequired);
      hasErr = true;
    } else if (!/^[A-Z][0-9]{9}$/.test(cleanMassar)) {
      setMassarError(fr.dossier.codeMassarFormatError);
      hasErr = true;
    } else {
      setMassarError(null);
    }

    if (!cleanWhatsapp) {
      setWhatsappError(fr.dossier.whatsappRequired);
      hasErr = true;
    } else if (!normaliserTel(cleanWhatsapp)) {
      setWhatsappError(fr.dossier.whatsappFormatError);
      hasErr = true;
    } else {
      setWhatsappError(null);
    }

    if (hasErr) return;

    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.cne = cleanMassar;
      curCandidat.tel = cleanWhatsapp;
      persistCandidate(curCandidat);
      setCandidat({ ...curCandidat });
      setMassarInput(cleanMassar);
      setApogeeCne(cleanMassar);

      const rawAcc = localStorage.getItem('usmba_active_account');
      if (rawAcc) {
        const acc = JSON.parse(rawAcc);
        if (acc && (!acc.email || !curCandidat.email || acc.email.toLowerCase() === curCandidat.email.toLowerCase())) {
          acc.cne = cleanMassar;
          acc.tel = cleanWhatsapp;
          localStorage.setItem('usmba_active_account', JSON.stringify(acc));
          window.dispatchEvent(new CustomEvent('usmba_account_updated'));
        }
      }

      setInfosSaved(true);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
      setTimeout(() => setInfosSaved(false), 2500);
    } catch {
      // safe fallback
    }
  };

  const handleCinModalFileUpload = (
    target: 'recto' | 'verso',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setSideError = (msg: string | null) => {
      if (target === 'recto') {
        setCinRectoUploadError(msg);
      } else {
        setCinVersoUploadError(msg);
      }
    };

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isJpegOrPng =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      /\.(jpe?g|png)$/i.test(file.name);

    if (!isPdf && !isJpegOrPng) {
      setSideError(fr.dossier.cinUploadFormatError);
      e.target.value = '';
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setSideError(fr.dossier.cinUploadSizeError);
      e.target.value = '';
      return;
    }

    setSideError(null);
    setFeedbackMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      let result = reader.result as string;
      if (!isPdf && isJpegOrPng) {
        result = await compressImageDataUrl(result);
      }
      try {
        const currentCin = pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
        const nextRecto = target === 'recto' ? result : currentCin?.fichier;
        const nextVerso = target === 'verso' ? result : currentCin?.fichierVerso;

        handleUpdateCinSide(target, result, 'televersement');
        if (target === 'recto') {
          setProvenCinRectoImgError(false);
        } else {
          setProvenCinVersoImgError(false);
        }
        if (nextRecto && nextVerso) {
          setCinUploadSplitOpen(false);
          setCinVerifyModalOpen(true);
        }
        openCinVerifyForm();
        void runCinOcr(nextRecto, nextVerso);
      } catch {
        setSideError(fr.dossier.quotaExceededSupprime);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileUpload = (
    type: PieceType,
    e: React.ChangeEvent<HTMLInputElement>,
    cinSide?: 'recto' | 'verso'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    // Fichier refusé au-delà de 1,5 Mo (image ou PDF)
    if (file.size > 1.5 * 1024 * 1024) {
      setFeedbackMessage({ type: 'error', text: fr.dossier.fileTooHeavyPdf });
      e.target.value = '';
      return;
    }

    setFeedbackMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      let result = reader.result as string;
      if (!isPdf && (file.type.startsWith('image/') || result.startsWith('data:image'))) {
        result = await compressImageDataUrl(result);
      }
      try {
        if (type.toUpperCase() === 'CIN') {
          const targetSide = cinSide || 'recto';
          const currentCin = pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
          const nextRecto = targetSide === 'recto' ? result : currentCin?.fichier;
          const nextVerso = targetSide === 'verso' ? result : currentCin?.fichierVerso;

          handleUpdateCinSide(targetSide, result, 'televersement');
          if (targetSide === 'recto') {
            setProvenCinRectoImgError(false);
          } else {
            setProvenCinVersoImgError(false);
          }
          openCinVerifyForm();
          if (nextRecto && nextVerso) {
            setCinVerifyModalOpen(true);
          }
          void runCinOcr(nextRecto, nextVerso);
        } else {
          handleUpdatePiece(type, {
            statut: 'prouvee',
            source: 'televersement',
            fichier: result,
            ocrResultat: undefined,
          });
        }
      } catch {
        setFeedbackMessage({
          type: 'error',
          text: fr.dossier.quotaExceededSupprime,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyOcrFieldsToForm = (fields: CinOcrFields) => {
    const { nom, prenom, cin, dateNaissance } = fields;
    if (nom) {
      setCinFormNom((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.nom) return prev;
        ocrFilledFieldsRef.current.nom = true;
        return nom;
      });
    }
    if (prenom) {
      setCinFormPrenom((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.prenom) return prev;
        ocrFilledFieldsRef.current.prenom = true;
        return prenom;
      });
    }
    if (cin) {
      setCinFormNumero((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.cin) return prev;
        ocrFilledFieldsRef.current.cin = true;
        return cin;
      });
    }
    if (dateNaissance) {
      setCinFormDateNaissance((prev) => {
        if (prev.trim() && !ocrFilledFieldsRef.current.dateNaissance) return prev;
        ocrFilledFieldsRef.current.dateNaissance = true;
        return dateNaissance;
      });
    }
  };

  const handleDualCinCaptureSuccess = (
    rectoDataUrl: string,
    versoDataUrl: string,
    extractedFields?: CinOcrFields
  ) => {
    setActiveCameraTarget(null);
    setCinUploadSplitOpen(false);
    handleUpdatePiece('CIN', {
      statut: 'prouvee',
      source: 'camera',
      fichier: rectoDataUrl,
      sourceVerso: 'camera',
      fichierVerso: versoDataUrl,
      ocrResultat: undefined,
    });
    setProvenCinRectoImgError(false);
    setProvenCinVersoImgError(false);
    openCinVerifyForm();
    setCinVerifyModalOpen(true);

    const hasPreExtracted = Boolean(
      extractedFields &&
        (extractedFields.nom ||
          extractedFields.prenom ||
          extractedFields.cin ||
          extractedFields.dateNaissance)
    );
    if (hasPreExtracted && extractedFields) {
      applyOcrFieldsToForm(extractedFields);
      const missingField =
        !extractedFields.nom ||
        !extractedFields.prenom ||
        !extractedFields.cin ||
        !extractedFields.dateNaissance;
      if (!missingField) {
        setCinOcrStatus('success');
        return;
      }
    }

    if (autoOcrCamera || hasPreExtracted) {
      void runCinOcr(rectoDataUrl, versoDataUrl, { autoOcrOnCameraCapture: true });
    }
  };

  const handleCaptureSuccess = (dataUrl: string) => {
    if (activeCameraTarget) {
      const { type: targetPiece, side } = activeCameraTarget;
      setActiveCameraTarget(null);
      if (targetPiece.toUpperCase() === 'CIN') {
        const targetSide = side || 'recto';
        const currentCin = pieces.find((p) => p && p.type && p.type.toUpperCase() === 'CIN');
        const nextRecto = targetSide === 'recto' ? dataUrl : currentCin?.fichier;
        const nextVerso = targetSide === 'verso' ? dataUrl : currentCin?.fichierVerso;
        handleUpdateCinSide(targetSide, dataUrl, 'camera');
        if (targetSide === 'recto') {
          setProvenCinRectoImgError(false);
        } else {
          setProvenCinVersoImgError(false);
        }
        openCinVerifyForm();
        if (nextRecto && nextVerso) {
          setCinVerifyModalOpen(true);
        }
        if (autoOcrCamera) {
          void runCinOcr(nextRecto, nextVerso, {
            autoOcrOnCameraCapture: true,
            cameraSide: targetSide,
          });
        }
      } else {
        handleUpdatePiece(targetPiece, {
          statut: 'prouvee',
          source: 'camera',
          fichier: dataUrl,
          ocrResultat: undefined,
        });
      }
    }
  };

  const handleCameraErrorFallback = (
    target: { type: PieceType; side?: 'recto' | 'verso'; dual?: boolean } | null
  ) => {
    setActiveCameraTarget(null);
    if (target) {
      if (target.type.toUpperCase() === 'CIN') {
        setCinRectoUploadError(null);
        setCinVersoUploadError(null);
        setCinUploadSplitOpen(true);
        return;
      }
      setTimeout(() => {
        fileInputRefs.current[target.type]?.click();
      }, 50);
    }
  };

  const handleVerifyApogee = () => {
    const cleanCne = apogeeCne.trim().toUpperCase();
    if (!/^[A-Z][0-9]{9}$/.test(cleanCne)) {
      setApogeeMessage({
        type: 'error',
        text: fr.dossier.cneFormatError,
      });
      return;
    }

    // Enregistre aussi le CNE du candidat
    try {
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      const curCandidat: Candidat = raw ? JSON.parse(raw) : (candidat || {});
      curCandidat.cne = cleanCne;
      localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(curCandidat));
      setCandidat(curCandidat);
    } catch {
      // safe fallback
    }

    const intitule = ApogeeFictif[cleanCne] || ApogeeFictif[apogeeCne.trim()];
    if (intitule) {
      setApogeeMessage({
        type: 'success',
        text: `${fr.dossier.concordanceApogee} : ${intitule}`,
      });
      try {
        const curCandidat = resolveCandidate(candidatId, candidat);
        curCandidat.cursus = {
          diplome: intitule,
          etablissement: 'Université Sidi Mohamed Ben Abdellah (USMBA)',
          anneeObtention: 2026,
        };
        persistCandidate(curCandidat);
        setCandidat(curCandidat);
      } catch {}
      // Règle stricte : la vérification Apogée (simulation) ne remplace JAMAIS un fichier
    } else {
      setApogeeMessage({
        type: 'error',
        text: fr.dossier.cneUnknown,
      });
    }
  };

  // Validation cas particulier : motif obligatoire si activé, et si 'AUTRE', champ texte obligatoire
  const isCasParticulierValid =
    !casParticulier || (motif !== '' && (motif !== 'AUTRE' || motifAutre.trim().length > 0));

  const handleSaveCasParticulier = () => {
    if (!isCasParticulierValid) return;
    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.dossier = {
        casParticulier,
        motif: casParticulier && motif ? (motif as MotifCasParticulier) : undefined,
        motifAutre: casParticulier && motif === 'AUTRE' ? motifAutre.trim() : undefined,
        guichet: Boolean(curCandidat.dossier?.guichet),
        guichetStatut: curCandidat.dossier?.guichetStatut,
        journalGuichet: curCandidat.dossier?.journalGuichet,
        saisiPar: curCandidat.dossier?.saisiPar,
        saisiLe: curCandidat.dossier?.saisiLe,
        consentementGuichet: curCandidat.dossier?.consentementGuichet,
        dateEnvoi: curCandidat.dossier?.dateEnvoi,
      };
      persistCandidate(curCandidat);
      setCandidat(curCandidat);
      setSaveCasSuccess(true);
      setTimeout(() => setSaveCasSuccess(false), 2500);
      setFeedbackMessage(null);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22 ||
        err?.code === 1014 ||
        err?.message?.toLowerCase().includes('quota');

      if (isQuota) {
        setFeedbackMessage({
          type: 'error',
          text: fr.dossier.quotaExceeded,
        });
      }
    }
  };

  // Compteurs : 1) Pièces déclarées ('declaree' ou 'prouvee') ; 2) Pièces prouvées ('prouvee')
  const safePieces = Array.isArray(pieces) ? pieces : [];

  const checkDossier = useMemo(() => {
    const cur = resolveCandidate(candidatId, candidat);
    return dossierComplet({
      ...cur,
      pieces: safePieces.length > 0 ? safePieces : (cur?.pieces || []),
    });
  }, [candidatId, candidat, safePieces]);

  // Compteur unique "N/3 pièces fournies"
  const piecesFourniesCount = Math.max(0, 3 - checkDossier.manques.length);
  const percentFournies = Math.round((piecesFourniesCount / 3) * 100);

  const hasSavedCinInfos = Boolean(
    candidat?.nomFamille?.trim() &&
    candidat?.prenom?.trim() &&
    candidat?.cin?.trim() &&
    /^[A-Za-z]{1,2}[0-9]{5,6}$/.test(candidat.cin.trim()) &&
    candidat?.dateNaissance?.trim() &&
    !validateDateNaissance(candidat.dateNaissance)
  );

  const candidaturesCount = candidatures.length;
  const hasThreeSubjects = candidaturesCount >= 3;
  const missingSubjectsCount = Math.max(0, 3 - candidaturesCount);
  const hasLegacyRetenue = Object.values(statuts).some((s) => s === 'retenue');
  const dateEnvoi = !hasACorriger
    ? candidat?.dossier?.dateEnvoi ||
      candidat?.envoyeLe ||
      Object.values(candidat?.candidaturesEnvoyeLe || {})[0]
    : undefined;
  const isDossierEnvoye = Boolean(dateEnvoi || (hasLegacyRetenue && !hasACorriger));

  useEffect(() => {
    if (autoOcrCamera && !isDirecteur && !isDossierEnvoye) {
      void prechargerOcrCin();
    }
  }, [autoOcrCamera, isDirecteur, isDossierEnvoye]);
  const hasSavedMassar = Boolean(
    candidat?.cne?.trim() && /^[A-Za-z][0-9]{9}$/.test(candidat.cne.trim())
  );
  const hasSavedWhatsapp = Boolean(
    candidat?.tel?.trim() && normaliserTel(candidat.tel.trim())
  );

  const activeAnomaliePieces = activeAnomalie
    ? activeAnomalie.pieces && activeAnomalie.pieces.length > 0
      ? activeAnomalie.pieces
      : [activeAnomalie.piece]
    : [];

  const isPieceFlaggedUnreplaced = (type: PieceType, pieceObj?: Piece): boolean => {
    if (isDirecteur || (!hasACorriger && pieceObj?.statut !== 'illisible')) return false;
    const upper = type.toUpperCase();
    const matches =
      pieceObj?.statut === 'illisible' ||
      activeAnomaliePieces.some(
        (ap) =>
          (ap === 'CIN' && upper === 'CIN') ||
          (ap === 'DIPLOME' && upper === 'DIPLOME') ||
          (ap === 'RELEVES' && upper === 'RELEVES') ||
          (ap === 'CURSUS' && upper === 'DIPLOME')
      );
    if (!matches) return false;
    if (!pieceObj || pieceObj.statut !== 'prouvee') return true;
    const pieceTime = pieceObj.dateMaj ? Date.parse(pieceObj.dateMaj) : 0;
    const anomalieTime = activeAnomalie?.le ? Date.parse(activeAnomalie.le) : 0;
    return !pieceTime || Number.isNaN(pieceTime) || (anomalieTime > 0 && pieceTime < anomalieTime);
  };

  const unreplacedAnomalieLabels = ORDERED_TYPES.filter((t) => {
    const found = safePieces.find((p) => p && p.type?.toUpperCase() === t.toUpperCase());
    return isPieceFlaggedUnreplaced(t, found);
  }).map((t) => (t === 'CIN' ? 'CIN' : t === 'DIPLOME' ? 'Diplôme' : 'Relevés'));

  const hasUnreplacedAnomaliePiece = unreplacedAnomalieLabels.length > 0;
  const canSendDossier =
    hasThreeSubjects &&
    checkDossier.complet &&
    !hasUnreplacedAnomaliePiece &&
    hasSavedCinInfos &&
    hasSavedMassar &&
    hasSavedWhatsapp;

  const missingItems: string[] = [];
  if (!hasThreeSubjects) {
    missingItems.push(
      missingSubjectsCount === 1
        ? fr.dossier.raisonSujetSingulier
        : fr.dossier.raisonSujetsPluriel.replace('{count}', String(missingSubjectsCount))
    );
  }
  const mergedMissingPieces = Array.from(new Set([...checkDossier.manques, ...unreplacedAnomalieLabels]));
  if (mergedMissingPieces.length > 0) {
    missingItems.push(...mergedMissingPieces);
  }
  if (!hasSavedMassar) {
    missingItems.push(fr.dossier.codeMassarManque);
  }
  if (!hasSavedWhatsapp) {
    missingItems.push(fr.dossier.whatsappManque);
  }
  const sendDisabledReason =
    missingItems.length > 0 && !hasSavedCinInfos
      ? `${fr.dossier.raisonManquePieces.replace('{manques}', missingItems.join(', '))} ${fr.dossier.raisonCinNonEnregistree}`
      : missingItems.length > 0
      ? fr.dossier.raisonManquePieces.replace('{manques}', missingItems.join(', '))
      : !hasSavedCinInfos
      ? fr.dossier.raisonCinNonEnregistree
      : null;

  const getPieceName = (type: PieceType): string => {
    const key = type.toUpperCase() as keyof typeof fr.dossier.pieces;
    return fr.dossier.pieces[key] || type;
  };

  const isImageFile = (fichier?: string) => {
    if (!fichier) return false;
    return (
      fichier.startsWith('data:image') ||
      fichier.includes('.svg') ||
      fichier.match(/\.(png|jpe?g|webp|gif)$/i)
    );
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Progression du candidat en haut de Mon dossier */}
      {!isDirecteur && (
        <ProgressionCandidat
          candidatId={candidat?.id || candidatId}
          candidat={candidat || undefined}
          onNavigate={onNavigate}
        />
      )}

      {/* 1. Ligne en haut si peutProuver : bandeau dynamique */}
      {peutProuver && piecesFourniesCount < 3 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl px-4 py-3 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            {isAdmisPv
              ? fr.dossier.bannerAdmisPreuves
              : fr.dossier.bannerConvoquePreuves}
          </span>
        </div>
      )}

      {/* Message de succès transmission */}
      {transmissionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{transmissionSuccess}</span>
        </div>
      )}

      {/* Candidat à corriger : bandeau "À corriger : [élément(s)], [motif]" */}
      {!isDirecteur && hasACorriger && activeAnomalie && (
        <div className="bg-rose-50 border border-rose-300 text-rose-950 rounded-2xl p-4 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span>
              À corriger :{' '}
              {activeAnomalie.pieces && activeAnomalie.pieces.length > 0
                ? activeAnomalie.pieces.join(', ')
                : activeAnomalie.piece}
              , {activeAnomalie.motif}
            </span>
          </div>
          <p className="text-[11px] text-rose-800">
            Nature : <span className="font-semibold uppercase">{activeAnomalie.nature}</span>. Veuillez fournir à nouveau la pièce pour pouvoir renvoyer votre candidature.
          </p>
        </div>
      )}

      {/* Compteur unique : N/3 pièces fournies */}
      <div id="compteur-pieces-fournies" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-slate-900">
              {fr.dossier.compteurPiecesFournies.replace('{count}', String(piecesFourniesCount))}
            </span>
            {isDossierEnvoye && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                <Send size={12} className="text-emerald-700 shrink-0" />
                <span>{fr.dossier.envoyeLeBadge.replace('{date}', formatDateJJMMAAAA(dateEnvoi))}</span>
              </span>
            )}
            {checkDossier.complet ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>{fr.dossierModule.allReadyBadge}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <AlertCircle size={13} className="text-rose-600 shrink-0" />
                <span>Manquants : {checkDossier.manques.join(', ')}</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {percentFournies}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentFournies}%` }}
          />
        </div>
      </div>

      {/* Coordonnées du candidat : Code Massar et Numéro WhatsApp */}
      {!isDirecteur && (
        <form
          id="infos-candidat"
          onSubmit={handleSaveInfosCandidat}
          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
        >
          <h3 className="text-xs font-bold text-slate-900">
            {fr.dossier.infosCandidatTitle}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dossier-massar-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                {fr.dossier.codeMassarLabel}
              </label>
              <input
                id="dossier-massar-input"
                type="text"
                value={massarInput}
                onChange={(e) => {
                  setMassarInput(e.target.value);
                  setMassarError(null);
                  setInfosSaved(false);
                }}
                placeholder={fr.dossier.codeMassarPlaceholder}
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                  massarError ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {massarError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{massarError}</p>
              )}
            </div>

            <div>
              <label htmlFor="dossier-whatsapp-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                {fr.dossier.whatsappLabel}
              </label>
              <input
                id="dossier-whatsapp-input"
                type="tel"
                value={whatsappInput}
                onChange={(e) => {
                  setWhatsappInput(e.target.value);
                  setWhatsappError(null);
                  setInfosSaved(false);
                }}
                placeholder={fr.dossier.whatsappPlaceholder}
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                  whatsappError ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {whatsappError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{whatsappError}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!isInfosCandidatFormValid}
                className={`min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  isInfosCandidatFormValid
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                }`}
              >
                {fr.dossier.enregistrerInfos}
              </button>
              {infosSaved && (
                <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>{fr.dossier.infosEnregistrees}</span>
                </span>
              )}
            </div>
            {!isInfosCandidatFormValid && (
              <p className="text-[11px] text-slate-500">
                {fr.dossier.infosCandidatDisabledReason}
              </p>
            )}
          </div>
        </form>
      )}

      {/* Message d'alerte / feedback */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs ${
            feedbackMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Une carte par pièce */}
      <div className="space-y-3">
        {ORDERED_TYPES.map((type) => {
          const piece =
            safePieces.find(
              (p) => p && (p.type === type || p.type?.toUpperCase() === type.toUpperCase())
            ) || { type, statut: 'absente' as const };

          const isImage = isImageFile(piece.fichier);
          const isPdf = piece.fichier && piece.fichier.includes('pdf');
          const isVersoImage = isImageFile(piece.fichierVerso);
          const isVersoPdf = piece.fichierVerso && piece.fichierVerso.includes('pdf');
          const isDiplome = type === 'DIPLOME' || type === 'diplome';
          const isCin = type === 'CIN' || type === 'cin';
          const hasCinRecto = Boolean(isCin && piece?.fichier && piece.source !== 'apogee');
          const hasCinVerso = Boolean(isCin && piece?.fichierVerso && piece.sourceVerso !== 'apogee');
          const hasAnyCinSide = hasCinRecto || hasCinVerso;
          const isCinPartial = isCin && hasAnyCinSide && !(hasCinRecto && hasCinVerso);
          const isProven = isCin
            ? Boolean(piece && piece.statut === 'prouvee' && hasCinRecto && hasCinVerso)
            : Boolean(
                piece &&
                piece.statut === 'prouvee' &&
                piece.fichier &&
                piece.source !== 'apogee'
              );

          const pieceMatchesAnomalie = Boolean(
            activeAnomaliePieces.some(
              (ap) =>
                (ap === 'CIN' && isCin) ||
                (ap === 'DIPLOME' && isDiplome) ||
                (ap === 'RELEVES' && type === 'RELEVES') ||
                (ap === 'CURSUS' && isDiplome)
            ) || piece.statut === 'illisible'
          );
          const isFlaggedForCorrection = isPieceFlaggedUnreplaced(type, piece);
          const effectiveIsProven = isProven && !isFlaggedForCorrection;

          const cardId = isDiplome
            ? 'carte-piece-diplome'
            : isCin
            ? 'carte-piece-cin'
            : 'carte-piece-releves';

          const isCinCollapsed =
            isCin &&
            hasSavedCinInfos &&
            !isCinEditing &&
            !cinVerifyModalOpen &&
            !isFlaggedForCorrection &&
            (effectiveIsProven || isDossierEnvoye);

          if (isCinCollapsed) {
            const nomMaj = (candidat?.nomFamille || '').trim().toUpperCase();
            const prenomTrim = (candidat?.prenom || '').trim();
            const cinTrim = (candidat?.cin || '').trim().toUpperCase();
            return (
              <React.Fragment key={type}>
                <div
                  id={cardId}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {`${fr.dossier.cinCollapsedLabel} · ${fr.dossier.fournieBadge} · ${nomMaj} ${prenomTrim} · ${cinTrim}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDossierEnvoye ? (
                      <>
                        {hasCinRecto && (
                          <button
                            type="button"
                            onClick={() => setViewingPiece({ piece, side: 'recto' })}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={13} className="text-slate-500" />
                            <span>{fr.dossier.btnVoirPiece}</span>
                          </button>
                        )}
                        {hasCinVerso && piece.fichierVerso !== piece.fichier && (
                          <button
                            type="button"
                            onClick={() => setViewingPiece({ piece, side: 'verso' })}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={13} className="text-slate-500" />
                            <span>{fr.dossierDirecteur.btnVoirVerso}</span>
                          </button>
                        )}
                      </>
                    ) : (
                      !isDirecteur && (
                        <button
                          type="button"
                          onClick={() => {
                            openCinVerifyForm();
                            setIsCinEditing(true);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-98"
                        >
                          <Pencil size={13} className="text-slate-500" />
                          <span>{fr.dossier.btnModifier}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={type}>
              <div
                id={cardId}
                className={`rounded-2xl p-4 shadow-xs space-y-3 border ${
                  isFlaggedForCorrection
                    ? 'bg-rose-50/30 border-rose-300 ring-1 ring-rose-200'
                    : 'bg-white border-slate-200'
                }`}
              >
              {/* Ligne 1 : Nom de la pièce + Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {isCin ? fr.dossier.cinCardTitle : getPieceName(type)}
                  </h3>
                  {!isCin && piece.source && effectiveIsProven && (
                    <p className="text-[10px] text-slate-400">
                      {fr.dossier.sources[piece.source] || piece.source}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {isFlaggedForCorrection ? (
                    <span className="inline-flex items-center gap-1.5 font-bold rounded-full bg-rose-50 text-rose-800 border border-rose-300 text-xs px-2.5 py-0.5">
                      <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                      <span>{fr.dossier.aCorriger}</span>
                    </span>
                  ) : effectiveIsProven ? (
                    <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>{fr.dossier.fournieBadge}</span>
                    </span>
                  ) : isCinPartial ? (
                    <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5">
                      <AlertCircle size={13} className="text-amber-600 shrink-0" />
                      <span>{fr.dossier.cinPartielleBadge}</span>
                    </span>
                  ) : pieceMatchesAnomalie ? (
                    <span className="inline-flex items-center gap-1.5 font-bold rounded-full bg-rose-50 text-rose-800 border border-rose-300 text-xs px-2.5 py-0.5">
                      <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                      <span>{fr.dossier.aCorriger}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs px-2.5 py-0.5">
                      <X size={13} className="text-slate-400 shrink-0" />
                      <span>{fr.statutsPiece.absente.label}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Alerte explicite sur la pièce signalée à corriger / remplacer */}
              {isFlaggedForCorrection && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-2.5 text-xs flex items-start gap-2">
                  <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {fr.dossier.pieceACorrigerHint.replace(
                      '{motif}',
                      activeAnomalie?.motif || fr.dossier.aCorriger
                    )}
                  </span>
                </div>
              )}

              {/* Cas particulier attestation sur la carte Diplôme */}
              {isDiplome && casParticulier && (
                <div className="bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-2.5 text-xs flex items-center gap-2">
                  <Info size={14} className="text-purple-600 shrink-0" />
                  <span>
                    Cas particulier ({motif === 'ATTESTATION_SANS_DIPLOME' ? 'Attestation sans diplôme' : (motifAutre || motif || 'Dérogatoire')}) : la pièce Diplôme peut être une attestation, mais reste à téléverser.
                  </span>
                </div>
              )}

              {/* Carte CIN : départ (Scanner + Téléverser), champs recto/verso uniquement au clic sur Téléverser, miniatures si chargée */}
              {isCin && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  {/* Aperçus des faces chargées (uniquement quand le panneau Téléverser n'est pas ouvert, ou si une face existe déjà) */}
                  {(hasCinRecto || hasCinVerso) && !cinUploadSplitOpen && (
                    <div className={`grid grid-cols-1 ${hasCinRecto && hasCinVerso ? 'sm:grid-cols-2' : ''} gap-3`}>
                      {hasCinRecto && (
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-800">
                              {fr.dossier.cinRectoLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <CheckCircle2 size={11} className="shrink-0" />
                              <span>{fr.dossier.fournieBadge}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-between">
                            {isImage && piece.fichier ? (
                              <div className="flex items-center gap-2">
                                {!provenCinRectoImgError ? (
                                  <img
                                    src={piece.fichier}
                                    alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinRectoLabel}`}
                                    onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                    onError={() => setProvenCinRectoImgError(true)}
                                    className="w-16 h-11 object-cover rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity bg-white"
                                  />
                                ) : (
                                  <div
                                    onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                    className="w-16 h-11 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center p-1 cursor-pointer hover:bg-slate-100 transition-colors"
                                  >
                                    <FileText size={16} className="text-slate-400" />
                                  </div>
                                )}
                                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[110px]">
                                  {piece.source === 'camera' ? 'Photo prise' : 'Fichier image'}
                                </span>
                              </div>
                            ) : isPdf ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                                <FileText size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate font-medium">
                                  {piece.fichier?.startsWith('data:') ? fr.dossier.pdfDocument : (piece.fichier || fr.dossier.pdfDocument)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                <span className="truncate font-medium">{piece.fichier || 'Pièce validée'}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                              >
                                <Eye size={13} className="text-slate-500" />
                                <span>{fr.dossier.btnVoirPiece}</span>
                              </button>
                              {!isDirecteur && !isDossierEnvoye && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateCinSide('recto', undefined, undefined);
                                    ocrRunIdRef.current += 1;
                                    setCinOcrStatus('idle');
                                    setCinFormTouched({});
                                    setCinVerifySaved(false);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                                >
                                  <RotateCcw size={13} className="text-rose-600" />
                                  <span>{fr.dossier.btnRemplacerPiece}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {hasCinVerso && (
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-800">
                              {fr.dossier.cinVersoLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <CheckCircle2 size={11} className="shrink-0" />
                              <span>{fr.dossier.fournieBadge}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-between">
                            {isVersoImage && piece.fichierVerso ? (
                              <div className="flex items-center gap-2">
                                {!provenCinVersoImgError ? (
                                  <img
                                    src={piece.fichierVerso}
                                    alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinVersoLabel}`}
                                    onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                    onError={() => setProvenCinVersoImgError(true)}
                                    className="w-16 h-11 object-cover rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity bg-white"
                                  />
                                ) : (
                                  <div
                                    onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                    className="w-16 h-11 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center p-1 cursor-pointer hover:bg-slate-100 transition-colors"
                                  >
                                    <FileText size={16} className="text-slate-400" />
                                  </div>
                                )}
                                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[110px]">
                                  {piece.sourceVerso === 'camera' ? 'Photo prise' : 'Fichier image'}
                                </span>
                              </div>
                            ) : isVersoPdf ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                                <FileText size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate font-medium">
                                  {piece.fichierVerso?.startsWith('data:') ? fr.dossier.pdfDocument : (piece.fichierVerso || fr.dossier.pdfDocument)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                <span className="truncate font-medium">{piece.fichierVerso || 'Pièce validée'}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                              >
                                <Eye size={13} className="text-slate-500" />
                                <span>{fr.dossier.btnVoirPiece}</span>
                              </button>
                              {!isDirecteur && !isDossierEnvoye && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateCinSide('verso', undefined, undefined);
                                    ocrRunIdRef.current += 1;
                                    setCinOcrStatus('idle');
                                    setCinVerifySaved(false);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                                >
                                  <RotateCcw size={13} className="text-rose-600" />
                                  <span>{fr.dossier.btnRemplacerPiece}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Boutons Scanner / Téléverser OU panneau divisé Recto / Verso avec Retour */}
                  {!isDirecteur && !isDossierEnvoye && !effectiveIsProven && (
                    <div className="space-y-2">
                      {!cinUploadSplitOpen ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCinUploadSplitOpen(false);
                                if (autoOcrCamera) {
                                  void prechargerOcrCin();
                                }
                                setActiveCameraTarget({ type, dual: true });
                              }}
                              className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                            >
                              <Camera size={15} />
                              <span>{fr.dossier.scannerCin}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCinRectoUploadError(null);
                                setCinVersoUploadError(null);
                                setCinUploadSplitOpen(true);
                              }}
                              className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                            >
                              <Upload size={15} />
                              <span>{fr.dossier.upload}</span>
                            </button>
                          </div>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={autoOcrCamera}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAutoOcrCamera(checked);
                                if (checked) {
                                  void prechargerOcrCin();
                                }
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                            />
                            <span>{fr.dossier.ocrAutoCameraOption}</span>
                          </label>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Champ 1 : Téléverser le recto */}
                            <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-2.5">
                              <span className="block text-[11px] font-bold text-slate-800">
                                {fr.dossier.cinUploadRectoLabel}
                              </span>
                              {hasCinRecto ? (
                                <div className="flex items-center gap-2 flex-wrap justify-between pt-0.5">
                                  {isImage && piece.fichier && !provenCinRectoImgError ? (
                                    <img
                                      src={piece.fichier}
                                      alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinRectoLabel}`}
                                      onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                      onError={() => setProvenCinRectoImgError(true)}
                                      className="w-14 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer bg-white"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                      className="w-14 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer"
                                    >
                                      <FileText size={15} className="text-slate-500" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => setViewingPiece({ piece, side: 'recto' })}
                                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                                    >
                                      <Eye size={12} />
                                      <span>{fr.dossier.btnVoirPiece}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateCinSide('recto', undefined, undefined);
                                        ocrRunIdRef.current += 1;
                                        setCinOcrStatus('idle');
                                        setCinFormTouched({});
                                        setCinVerifySaved(false);
                                        setCinRectoUploadError(null);
                                      }}
                                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
                                    >
                                      <RotateCcw size={12} />
                                      <span>{fr.dossier.btnRemplacerPiece}</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current['CIN_recto']?.click()}
                                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                                >
                                  <Upload size={14} className="text-emerald-700" />
                                  <span>{fr.dossier.cinUploadChooseFile}</span>
                                </button>
                              )}
                              {cinRectoUploadError && (
                                <p className="text-[11px] font-medium text-rose-700 flex items-center gap-1 pt-0.5">
                                  <AlertCircle size={13} className="shrink-0 text-rose-600" />
                                  <span>{cinRectoUploadError}</span>
                                </p>
                              )}
                            </div>

                            {/* Champ 2 : Téléverser le verso */}
                            <div className="space-y-1.5 bg-white border border-slate-200 rounded-xl p-2.5">
                              <span className="block text-[11px] font-bold text-slate-800">
                                {fr.dossier.cinUploadVersoLabel}
                              </span>
                              {hasCinVerso ? (
                                <div className="flex items-center gap-2 flex-wrap justify-between pt-0.5">
                                  {isVersoImage && piece.fichierVerso && !provenCinVersoImgError ? (
                                    <img
                                      src={piece.fichierVerso}
                                      alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinVersoLabel}`}
                                      onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                      onError={() => setProvenCinVersoImgError(true)}
                                      className="w-14 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer bg-white"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                      className="w-14 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer"
                                    >
                                      <FileText size={15} className="text-slate-500" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => setViewingPiece({ piece, side: 'verso' })}
                                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                                    >
                                      <Eye size={12} />
                                      <span>{fr.dossier.btnVoirPiece}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateCinSide('verso', undefined, undefined);
                                        ocrRunIdRef.current += 1;
                                        setCinOcrStatus('idle');
                                        setCinVerifySaved(false);
                                        setCinVersoUploadError(null);
                                      }}
                                      className="px-2 py-1 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
                                    >
                                      <RotateCcw size={12} />
                                      <span>{fr.dossier.btnRemplacerPiece}</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fileInputRefs.current['CIN_verso']?.click()}
                                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                                >
                                  <Upload size={14} className="text-emerald-700" />
                                  <span>{fr.dossier.cinUploadChooseFile}</span>
                                </button>
                              )}
                              {cinVersoUploadError && (
                                <p className="text-[11px] font-medium text-rose-700 flex items-center gap-1 pt-0.5">
                                  <AlertCircle size={13} className="shrink-0 text-rose-600" />
                                  <span>{cinVersoUploadError}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-[11px] text-slate-500">
                              {fr.dossier.cinUploadFormatsHint}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setCinRectoUploadError(null);
                                setCinVersoUploadError(null);
                                setCinUploadSplitOpen(false);
                              }}
                              className="min-h-[34px] px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <ArrowLeft size={13} />
                              <span>{fr.dossier.btnRetour}</span>
                            </button>
                          </div>

                          <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                            ref={(el) => {
                              fileInputRefs.current['CIN_recto'] = el;
                            }}
                            onChange={(e) => handleCinModalFileUpload('recto', e)}
                            className="hidden"
                          />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                            ref={(el) => {
                              fileInputRefs.current['CIN_verso'] = el;
                            }}
                            onChange={(e) => handleCinModalFileUpload('verso', e)}
                            className="hidden"
                          />
                        </div>
                      )}

                      <p className="text-xs text-slate-500">
                        {fr.dossier.noteScanOriginal}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Autres pièces (Diplôme, Relevés) 'prouvee' : aperçu + boutons Voir et Remplacer */}
              {!isCin && effectiveIsProven && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    {/* Miniature ou résumé */}
                    {isImage && piece.fichier ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={piece.fichier}
                          alt={getPieceName(type)}
                          onClick={() => setViewingPiece({ piece })}
                          className="w-16 h-11 object-cover rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[130px]">
                          {piece.source === 'camera' ? 'Photo prise' : 'Fichier image'}
                        </span>
                      </div>
                    ) : isPdf ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                        <FileText size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{piece.fichier?.startsWith('data:') ? fr.dossier.pdfDocument : (piece.fichier || fr.dossier.pdfDocument)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span className="truncate font-medium">{piece.fichier || 'Pièce validée'}</span>
                      </div>
                    )}

                    {/* Boutons Voir et Remplacer */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => setViewingPiece({ piece })}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                      >
                        <Eye size={13} className="text-slate-500" />
                        <span>{fr.dossier.btnVoirPiece}</span>
                      </button>

                      {!isDirecteur && !isDossierEnvoye && (
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdatePiece(type, {
                              statut: 'absente',
                              fichier: undefined,
                              source: undefined,
                              ocrResultat: undefined,
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                        >
                          <RotateCcw size={13} className="text-rose-600" />
                          <span>{fr.dossier.btnRemplacerPiece}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Formulaire Vos informations (sous la CIN, masqué tant que le pop-up de vérification est ouvert) */}
              {isCin && hasAnyCinSide && !cinVerifyModalOpen && !isDirecteur && !isDossierEnvoye && (
                <form
                  id="vos-informations-cin"
                  onSubmit={handleSaveVosInfos}
                  noValidate
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900">
                      {fr.dossier.verifiezInfosTitle}
                    </h4>
                    {cinOcrStatus === 'loading' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                        <Loader2 size={13} className="animate-spin shrink-0" />
                        <span>{fr.dossier.ocrEnCours}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row gap-3.5 items-start">
                    {/* Miniatures Recto/Verso de la pièce chargée : au-dessus (mobile), à côté (bureau) */}
                    <div className="w-full md:w-40 shrink-0 grid grid-cols-2 md:grid-cols-1 gap-2">
                      {hasCinRecto && (
                        isImage && piece.fichier && !provenCinRectoImgError ? (
                          <img
                            src={piece.fichier}
                            alt={`${getPieceName(type)} — ${fr.dossier.cinRectoLabel}`}
                            onClick={() => setViewingPiece({ piece, side: 'recto' })}
                            onError={() => setProvenCinRectoImgError(true)}
                            className="w-full h-24 object-contain bg-white rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setViewingPiece({ piece, side: 'recto' })}
                            className="w-full h-20 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <FileText size={18} className="text-slate-400" />
                            <span className="text-[11px] font-medium truncate max-w-full">
                              {fr.dossier.cinRectoLabel}
                            </span>
                          </button>
                        )
                      )}

                      {hasCinVerso && (
                        isVersoImage && piece.fichierVerso && !provenCinVersoImgError ? (
                          <img
                            src={piece.fichierVerso}
                            alt={`${getPieceName(type)} — ${fr.dossier.cinVersoLabel}`}
                            onClick={() => setViewingPiece({ piece, side: 'verso' })}
                            onError={() => setProvenCinVersoImgError(true)}
                            className="w-full h-24 object-contain bg-white rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setViewingPiece({ piece, side: 'verso' })}
                            className="w-full h-20 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1 p-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <FileText size={18} className="text-slate-400" />
                            <span className="text-[11px] font-medium truncate max-w-full">
                              {fr.dossier.cinVersoLabel}
                            </span>
                          </button>
                        )
                      )}
                    </div>

                    {/* 4 champs : 2 colonnes sur bureau, 1 colonne sur mobile */}
                    <div className="flex-1 w-full min-w-0 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Nom */}
                        <div>
                          <label htmlFor="cin-form-nom" className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.dossier.nomLabel} *
                          </label>
                          <input
                            id="cin-form-nom"
                            type="text"
                            value={cinFormNom}
                            onChange={(e) => {
                              ocrFilledFieldsRef.current.nom = false;
                              setCinFormNom(e.target.value);
                              setCinFormTouched((prev) => ({ ...prev, nom: true }));
                              setCinVerifySaved(false);
                            }}
                            onBlur={() => setCinFormTouched((prev) => ({ ...prev, nom: true }))}
                            className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                              cinFormTouched.nom && cinFormErrors.nom ? 'border-rose-400' : 'border-slate-300'
                            }`}
                          />
                          {cinFormTouched.nom && cinFormErrors.nom && (
                            <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.nom}</p>
                          )}
                        </div>

                        {/* 2. Prénom */}
                        <div>
                          <label htmlFor="cin-form-prenom" className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.dossier.prenomLabel} *
                          </label>
                          <input
                            id="cin-form-prenom"
                            type="text"
                            value={cinFormPrenom}
                            onChange={(e) => {
                              ocrFilledFieldsRef.current.prenom = false;
                              setCinFormPrenom(e.target.value);
                              setCinFormTouched((prev) => ({ ...prev, prenom: true }));
                              setCinVerifySaved(false);
                            }}
                            onBlur={() => setCinFormTouched((prev) => ({ ...prev, prenom: true }))}
                            className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                              cinFormTouched.prenom && cinFormErrors.prenom ? 'border-rose-400' : 'border-slate-300'
                            }`}
                          />
                          {cinFormTouched.prenom && cinFormErrors.prenom && (
                            <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.prenom}</p>
                          )}
                        </div>

                        {/* 3. N° de CIN */}
                        <div>
                          <label htmlFor="cin-form-numero" className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.dossier.cinNumeroLabel} *
                          </label>
                          <input
                            id="cin-form-numero"
                            type="text"
                            value={cinFormNumero}
                            onChange={(e) => {
                              ocrFilledFieldsRef.current.cin = false;
                              setCinFormNumero(e.target.value);
                              setCinFormTouched((prev) => ({ ...prev, cin: true }));
                              setCinVerifySaved(false);
                            }}
                            onBlur={() => setCinFormTouched((prev) => ({ ...prev, cin: true }))}
                            placeholder={fr.dossier.cinNumeroPlaceholder}
                            className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                              (cinFormTouched.cin || cinFormNumero.trim().length > 0) && cinFormErrors.cin
                                ? 'border-rose-400'
                                : 'border-slate-300'
                            }`}
                          />
                          {(cinFormTouched.cin || cinFormNumero.trim().length > 0) && cinFormErrors.cin && (
                            <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.cin}</p>
                          )}
                        </div>

                        {/* 4. Date de naissance (JJ/MM/AAAA) */}
                        <div>
                          <label htmlFor="cin-form-date-naissance" className="block text-[11px] font-bold text-slate-700 mb-1">
                            {fr.dossier.dateNaissanceLabel} *
                          </label>
                          <input
                            id="cin-form-date-naissance"
                            type="text"
                            value={cinFormDateNaissance}
                            onChange={(e) => {
                              ocrFilledFieldsRef.current.dateNaissance = false;
                              setCinFormDateNaissance(e.target.value);
                              setCinFormTouched((prev) => ({ ...prev, dateNaissance: true }));
                              setCinVerifySaved(false);
                            }}
                            onBlur={() => setCinFormTouched((prev) => ({ ...prev, dateNaissance: true }))}
                            placeholder={fr.dossier.dateNaissancePlaceholder}
                            className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                              (cinFormTouched.dateNaissance || cinFormDateNaissance.trim().length > 0) &&
                              cinFormErrors.dateNaissance
                                ? 'border-rose-400'
                                : 'border-slate-300'
                            }`}
                          />
                          {(cinFormTouched.dateNaissance || cinFormDateNaissance.trim().length > 0) &&
                            cinFormErrors.dateNaissance && (
                              <p className="text-[11px] text-rose-600 font-medium mt-1">
                                {cinFormErrors.dateNaissance}
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={!canSaveCinForm}
                            className={`min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              canSaveCinForm
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {fr.dossier.enregistrerInfos}
                          </button>
                          {cinVerifySaved && (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>{fr.dossier.infosEnregistrees}</span>
                            </span>
                          )}
                        </div>
                        {!canSaveCinForm && (
                          <p className="text-[11px] text-slate-500">
                            {!hasCinVersoUploaded
                              ? fr.dossier.vosInfosVersoRequiredReason
                              : fr.dossier.vosInfosDisabledReason}
                          </p>
                        )}
                        {cinOcrStatus === 'success' && (
                          <p className="text-[11px] text-slate-600">
                            {fr.dossier.ocrAutoFilledNotice}
                          </p>
                        )}
                        {cinOcrStatus === 'error' && (
                          <p className="text-[11px] text-amber-700 font-medium">
                            {fr.dossier.ocrLectureImpossible}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* Boutons Prendre en photo et Téléverser pour les autres pièces (Diplôme, Relevés, CV) */}
              {!isCin && !isDirecteur && !isDossierEnvoye && !effectiveIsProven && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCameraTarget({ type })}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                    >
                      <Camera size={15} />
                      <span>{fr.dossier.takePhoto}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[type]?.click()}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                    >
                      <Upload size={15} />
                      <span>{fr.dossier.upload}</span>
                    </button>

                    {/* Input fichier caché (1,5 Mo max) */}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      ref={(el) => {
                        fileInputRefs.current[type] = el;
                      }}
                      onChange={(e) => handleFileUpload(type, e)}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {fr.dossier.noteScanOriginal}
                  </p>
                </div>
              )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 3. CAS PARTICULIER (en bas de l'écran) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              {fr.dossier.casParticulierTitle}
            </h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={casParticulier}
              onChange={(e) => {
                setCasParticulier(e.target.checked);
                setSaveCasSuccess(false);
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <p className="text-sm text-slate-500">
          {fr.dossier.casParticulierHelp}
        </p>

        {casParticulier && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div>
              <select
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value as MotifCasParticulier);
                  setSaveCasSuccess(false);
                }}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">{fr.dossier.selectMotif}</option>
                <option value="ATTESTATION_SANS_DIPLOME">
                  {fr.dossier.casParticulierMotifs.ATTESTATION_SANS_DIPLOME}
                </option>
                <option value="DIPLOME_ETRANGER">
                  {fr.dossier.casParticulierMotifs.DIPLOME_ETRANGER}
                </option>
                <option value="INGENIEUR_SANS_LICENCE">
                  {fr.dossier.casParticulierMotifs.INGENIEUR_SANS_LICENCE}
                </option>
                <option value="AUTRE">
                  {fr.dossier.casParticulierMotifs.AUTRE}
                </option>
              </select>
            </div>

            {motif === 'AUTRE' && (
              <div>
                <input
                  type="text"
                  maxLength={120}
                  value={motifAutre}
                  onChange={(e) => {
                    setMotifAutre(e.target.value);
                    setSaveCasSuccess(false);
                  }}
                  placeholder={fr.dossier.autreMotifPlaceholder}
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <span className="text-[10px] text-slate-400 block text-right mt-0.5">
                  {motifAutre.length}/120
                </span>
              </div>
            )}

            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isCasParticulierValid}
                  onClick={handleSaveCasParticulier}
                  className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isCasParticulierValid
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-98'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {fr.dossier.saveCasParticulier}
                </button>
                {saveCasSuccess && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    {fr.dossier.savedCasParticulier}
                  </span>
                )}
              </div>
              {!isCasParticulierValid && (
                <p className="text-sm text-slate-500">
                  {!motif
                    ? fr.dossier.chooseMotifReason
                    : motif === 'AUTRE' && !motifAutre.trim()
                    ? fr.dossier.specifyMotifReason
                    : fr.dossier.motifRequiredError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. ENVOI DU DOSSIER (en bas de la page Dossier) */}
      {!isDirecteur && (
        <div
          id="bloc-envoi-dossier"
          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5"
        >
          {isDossierEnvoye ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 w-fit">
                <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                <span>{fr.dossier.envoyeLeBadge.replace('{date}', formatDateJJMMAAAA(dateEnvoi))}</span>
              </span>
              <button
                type="button"
                disabled
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5 cursor-default shrink-0"
              >
                <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                <span>{fr.dossier.candidatureEnvoyeeBtn}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                disabled={!canSendDossier}
                onClick={() => setConfirmEnvoiOpen(true)}
                className={`w-full min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                  canSendDossier
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                }`}
              >
                <Send size={15} />
                <span>
                  {hasACorriger ? fr.dossier.btnRenvoyerCandidature : fr.dossier.btnEnvoyerCandidature}
                </span>
              </button>
              {!canSendDossier && sendDisabledReason && (
                <p className="text-xs font-medium text-rose-700 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{sendDisabledReason}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal confirmation envoi de la candidature */}
      {confirmEnvoiOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmEnvoiOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {fr.dossier.modalEnvoiCandidatureTitre}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmEnvoiOpen(false)}
                aria-label={fr.dossier.close}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {fr.dossier.modalEnvoiCandidatureMessage}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmEnvoiOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {fr.dossier.modalEnvoiCancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmEnvoyerDossier}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Send size={14} />
                <span>{fr.dossier.modalEnvoiConfirm}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Caméra */}
      {activeCameraTarget && (
        <CameraCapture
          title={
            activeCameraTarget.type.toUpperCase() === 'CIN' && activeCameraTarget.side && !activeCameraTarget.dual
              ? `${getPieceName(activeCameraTarget.type)} — ${
                  activeCameraTarget.side === 'recto'
                    ? fr.dossier.cinRectoLabel
                    : fr.dossier.cinVersoLabel
                }`
              : getPieceName(activeCameraTarget.type)
          }
          onCapture={handleCaptureSuccess}
          onCaptureDual={activeCameraTarget.dual ? handleDualCinCaptureSuccess : undefined}
          dualStepLabels={
            activeCameraTarget.dual
              ? [fr.dossier.cinScanRectoStep, fr.dossier.cinScanVersoStep]
              : undefined
          }
          autoOcrOnCapture={activeCameraTarget.type.toUpperCase() === 'CIN' ? autoOcrCamera : false}
          onCaptureAutoOcr={
            activeCameraTarget.type.toUpperCase() === 'CIN' && autoOcrCamera
              ? (dataUrl, side) => {
                  if (activeCameraTarget.dual && side === 'recto') {
                    void runCinOcr(dataUrl, undefined, {
                      autoOcrOnCameraCapture: true,
                      cameraSide: 'recto',
                    });
                  }
                }
              : undefined
          }
          onClose={() => setActiveCameraTarget(null)}
          onErrorFallback={() => handleCameraErrorFallback(activeCameraTarget)}
        />
      )}



      {/* Modal Aperçu Agrandie (Voir) */}
      {viewingPiece && (() => {
        const viewedFichier =
          viewingPiece.side === 'verso'
            ? viewingPiece.piece.fichierVerso
            : viewingPiece.piece.fichier;
        const viewedSource =
          viewingPiece.side === 'verso'
            ? viewingPiece.piece.sourceVerso
            : viewingPiece.piece.source;
        const viewedTitle = viewingPiece.side
          ? `${getPieceName(viewingPiece.piece.type)} — ${
              viewingPiece.side === 'recto'
                ? fr.dossier.cinRectoLabel
                : fr.dossier.cinVersoLabel
            }`
          : getPieceName(viewingPiece.piece.type);

        return (
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingPiece(null);
            }}
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              {/* En-tête modal */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye size={16} className="text-emerald-700 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {viewedTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPiece(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Corps modal : aperçu agrandi */}
              <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100/60 min-h-[220px]">
                {isImageFile(viewedFichier) ? (
                  <img
                    src={viewedFichier}
                    alt={viewedTitle}
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl border border-slate-300 shadow-md bg-white"
                  />
                ) : viewedSource === 'apogee' ? (
                  <div className="bg-white border border-emerald-200 rounded-2xl p-6 text-center space-y-3 max-w-md w-full shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                      <Award size={26} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {fr.dossier.apogeeDiplomeTitle}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fr.dossier.apogeeDiplomeDesc}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100 text-xs text-emerald-950 font-semibold">
                      {viewedFichier || 'Master / Diplôme certifié USMBA'}
                    </div>
                    {candidat?.cne && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        CNE : {candidat.cne}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3 max-w-md w-full shadow-sm">
                    <FileText size={36} className="text-slate-400 mx-auto" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {fr.dossier.pdfDocument}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono mt-1 break-all">
                        {viewedFichier?.startsWith('data:')
                          ? 'document_televerse.pdf'
                          : (viewedFichier || 'document.pdf')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pied modal */}
              <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingPiece(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                >
                  {fr.dossier.close}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Pop-up Formulaire de vérification CIN après import Recto + Verso */}
      {cinVerifyModalOpen && !isDirecteur && !isDossierEnvoye && (() => {
        const cinPiece = safePieces.find(
          (p) => p && (p.type === 'CIN' || p.type?.toUpperCase() === 'CIN')
        );
        const modalHasRecto = Boolean(cinPiece?.fichier && cinPiece.source !== 'apogee');
        const modalHasVerso = Boolean(cinPiece?.fichierVerso && cinPiece.sourceVerso !== 'apogee');
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cin-verify-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCinVerifyModalOpen(false);
            }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <form
              onSubmit={handleSaveVosInfos}
              noValidate
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 id="cin-verify-modal-title" className="text-sm font-bold text-slate-900 truncate">
                    {fr.dossier.verifiezInfosTitle}
                  </h3>
                  {cinOcrStatus === 'loading' && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 shrink-0">
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      <span>{fr.dossier.ocrEnCours}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCinVerifyModalOpen(false)}
                  aria-label={fr.dossier.close}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {(modalHasRecto || modalHasVerso) && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {modalHasRecto && cinPiece && (
                      isImageFile(cinPiece.fichier) && !provenCinRectoImgError ? (
                        <img
                          src={cinPiece.fichier}
                          alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinRectoLabel}`}
                          className="w-full h-24 object-contain bg-slate-50 rounded-lg border border-slate-200"
                        />
                      ) : (
                        <div className="w-full h-24 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-xs text-slate-600">
                          <FileText size={18} className="text-slate-400" />
                          <span className="text-[11px] font-medium">{fr.dossier.cinRectoLabel}</span>
                        </div>
                      )
                    )}
                    {modalHasVerso && cinPiece && (
                      isImageFile(cinPiece.fichierVerso) && !provenCinVersoImgError ? (
                        <img
                          src={cinPiece.fichierVerso}
                          alt={`${fr.dossier.cinCardTitle} — ${fr.dossier.cinVersoLabel}`}
                          className="w-full h-24 object-contain bg-slate-50 rounded-lg border border-slate-200"
                        />
                      ) : (
                        <div className="w-full h-24 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-xs text-slate-600">
                          <FileText size={18} className="text-slate-400" />
                          <span className="text-[11px] font-medium">{fr.dossier.cinVersoLabel}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cin-modal-nom" className="block text-[11px] font-bold text-slate-700 mb-1">
                      {fr.dossier.nomLabel} *
                    </label>
                    <input
                      id="cin-modal-nom"
                      type="text"
                      value={cinFormNom}
                      onChange={(e) => {
                        ocrFilledFieldsRef.current.nom = false;
                        setCinFormNom(e.target.value);
                        setCinFormTouched((prev) => ({ ...prev, nom: true }));
                        setCinVerifySaved(false);
                      }}
                      onBlur={() => setCinFormTouched((prev) => ({ ...prev, nom: true }))}
                      className={`w-full min-h-[38px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        cinFormTouched.nom && cinFormErrors.nom ? 'border-rose-400' : 'border-slate-300'
                      }`}
                    />
                    {cinFormTouched.nom && cinFormErrors.nom && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.nom}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="cin-modal-prenom" className="block text-[11px] font-bold text-slate-700 mb-1">
                      {fr.dossier.prenomLabel} *
                    </label>
                    <input
                      id="cin-modal-prenom"
                      type="text"
                      value={cinFormPrenom}
                      onChange={(e) => {
                        ocrFilledFieldsRef.current.prenom = false;
                        setCinFormPrenom(e.target.value);
                        setCinFormTouched((prev) => ({ ...prev, prenom: true }));
                        setCinVerifySaved(false);
                      }}
                      onBlur={() => setCinFormTouched((prev) => ({ ...prev, prenom: true }))}
                      className={`w-full min-h-[38px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        cinFormTouched.prenom && cinFormErrors.prenom ? 'border-rose-400' : 'border-slate-300'
                      }`}
                    />
                    {cinFormTouched.prenom && cinFormErrors.prenom && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.prenom}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="cin-modal-numero" className="block text-[11px] font-bold text-slate-700 mb-1">
                      {fr.dossier.cinNumeroLabel} *
                    </label>
                    <input
                      id="cin-modal-numero"
                      type="text"
                      value={cinFormNumero}
                      onChange={(e) => {
                        ocrFilledFieldsRef.current.cin = false;
                        setCinFormNumero(e.target.value);
                        setCinFormTouched((prev) => ({ ...prev, cin: true }));
                        setCinVerifySaved(false);
                      }}
                      onBlur={() => setCinFormTouched((prev) => ({ ...prev, cin: true }))}
                      placeholder={fr.dossier.cinNumeroPlaceholder}
                      className={`w-full min-h-[38px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        (cinFormTouched.cin || cinFormNumero.trim().length > 0) && cinFormErrors.cin
                          ? 'border-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                    {(cinFormTouched.cin || cinFormNumero.trim().length > 0) && cinFormErrors.cin && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{cinFormErrors.cin}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="cin-modal-date-naissance" className="block text-[11px] font-bold text-slate-700 mb-1">
                      {fr.dossier.dateNaissanceLabel} *
                    </label>
                    <input
                      id="cin-modal-date-naissance"
                      type="text"
                      value={cinFormDateNaissance}
                      onChange={(e) => {
                        ocrFilledFieldsRef.current.dateNaissance = false;
                        setCinFormDateNaissance(e.target.value);
                        setCinFormTouched((prev) => ({ ...prev, dateNaissance: true }));
                        setCinVerifySaved(false);
                      }}
                      onBlur={() => setCinFormTouched((prev) => ({ ...prev, dateNaissance: true }))}
                      placeholder={fr.dossier.dateNaissancePlaceholder}
                      className={`w-full min-h-[38px] px-2.5 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                        (cinFormTouched.dateNaissance || cinFormDateNaissance.trim().length > 0) &&
                        cinFormErrors.dateNaissance
                          ? 'border-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                    {(cinFormTouched.dateNaissance || cinFormDateNaissance.trim().length > 0) &&
                      cinFormErrors.dateNaissance && (
                        <p className="text-[11px] text-rose-600 font-medium mt-1">
                          {cinFormErrors.dateNaissance}
                        </p>
                      )}
                  </div>
                </div>

                {cinOcrStatus === 'success' && (
                  <p className="text-[11px] text-slate-600">
                    {fr.dossier.ocrAutoFilledNotice}
                  </p>
                )}
                {cinOcrStatus === 'error' && (
                  <p className="text-[11px] text-slate-600">
                    {fr.dossier.ocrLectureImpossible}
                  </p>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!canSaveCinForm}
                    className={`min-h-[38px] px-5 py-2 text-xs font-bold rounded-xl transition-colors ${
                      canSaveCinForm
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {fr.dossier.enregistrerInfos}
                  </button>
                </div>
                {!canSaveCinForm && (
                  <p className="text-[11px] text-slate-500 text-right">
                    {!hasCinVersoUploaded
                      ? fr.dossier.vosInfosVersoRequiredReason
                      : fr.dossier.vosInfosDisabledReason}
                  </p>
                )}
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
};
