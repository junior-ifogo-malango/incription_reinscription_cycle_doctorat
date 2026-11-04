import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, CheckCircle2, AlertCircle, X, Eye, RotateCcw, Award, ShieldCheck, UserCheck } from 'lucide-react';
import { Piece, PieceType, Candidat, MotifCasParticulier, PV } from '../types';
import { ApogeeFictif, MOCK_CANDIDATS } from '../data/mockData';
import { StatusBadge } from './StatusBadge';
import { CameraCapture } from './CameraCapture';
import { fr } from '../i18n/fr';
import { lireCIN, OcrResultatCIN } from '../utils/ocrSimule';

function findCandidateById(id?: string): Candidat | null {
  if (!id) return null;
  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      if (overrides[id]) return overrides[id];
    }
  } catch {}
  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      if (cur.id === id) return cur;
    }
  } catch {}
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      const found = accounts.find((a) => a.id === id);
      if (found) return found;
    }
  } catch {}
  const mock = MOCK_CANDIDATS.find((c) => c.id === id);
  if (mock) return mock;
  return null;
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
  } catch {}
}

function resolveCandidate(candidatId?: string, fallback?: Candidat | null): Candidat {
  if (candidatId) {
    const found = findCandidateById(candidatId);
    if (found) return found;
  }
  try {
    const raw = localStorage.getItem('usmba_doctorat_candidat');
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback || {
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

const ORDERED_TYPES: PieceType[] = ['CIN', 'DIPLOME', 'RELEVES', 'CV'];

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
    statut: 'prouvee',
    source: 'apogee',
    fichier: 'master_sciences_techniques_usmba.pdf',
  },
  {
    type: 'RELEVES',
    statut: 'declaree',
  },
  {
    type: 'CV',
    statut: 'declaree',
  },
];

const DEFAULT_PIECES: Piece[] = [
  { type: 'CIN', statut: 'absente' },
  { type: 'DIPLOME', statut: 'absente' },
  { type: 'RELEVES', statut: 'absente' },
  { type: 'CV', statut: 'absente' },
];

export const Dossier: React.FC<{ candidatId?: string }> = ({ candidatId }) => {
  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [activeCameraPiece, setActiveCameraPiece] = useState<PieceType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null);
  const [apogeeCne, setApogeeCne] = useState<string>('');
  const [apogeeConsent, setApogeeConsent] = useState<boolean>(false);
  const [apogeeMessage, setApogeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cinInput, setCinInput] = useState<string>('');
  const [cinMessage, setCinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OcrResultatCIN | null>(null);
  const [showOcrPanel, setShowOcrPanel] = useState<boolean>(false);
  const [ocrEditNom, setOcrEditNom] = useState<string>('');
  const [ocrEditCin, setOcrEditCin] = useState<string>('');
  const [ecartChoix, setEcartChoix] = useState<'lue' | 'saisie' | null>(null);
  const [cinImgError, setCinImgError] = useState<boolean>(false);
  const [provenCinImgError, setProvenCinImgError] = useState<boolean>(false);
  const [pvs, setPvs] = useState<PV[]>([]);
  const [viewingPiece, setViewingPiece] = useState<Piece | null>(null);

  // Cas particulier & Guichet state
  const [casParticulier, setCasParticulier] = useState<boolean>(false);
  const [motif, setMotif] = useState<MotifCasParticulier | ''>('');
  const [motifAutre, setMotifAutre] = useState<string>('');
  const [guichet, setGuichet] = useState<boolean>(false);
  const [saveCasSuccess, setSaveCasSuccess] = useState<boolean>(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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
          setCandidat(parsed);
          if (parsed.cne) {
            setApogeeCne(parsed.cne);
          }
          if (parsed.cin) {
            setCinInput(parsed.cin);
          }
          if (parsed.dossier) {
            setCasParticulier(Boolean(parsed.dossier.casParticulier));
            setMotif(parsed.dossier.motif || '');
            setMotifAutre(parsed.dossier.motifAutre || '');
            setGuichet(Boolean(parsed.dossier.guichet));
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
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('usmba_pvs_updated', loadData);
      window.removeEventListener('usmba_pieces_updated', loadData);
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
          text: fr.dossier.quotaExceeded,
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
      pieces.length === 4
        ? pieces
        : ORDERED_TYPES.map((t) => {
            const found = pieces.find((p) => p.type.toUpperCase() === t.toUpperCase());
            return found || { type: t, statut: 'absente' as const };
          });

    const updated = currentList.map((p) => {
      if (p.type.toUpperCase() === type.toUpperCase()) {
        return {
          ...p,
          ...updates,
          type,
        };
      }
      return p;
    });
    savePieces(updated);
  };

  const demarrerOcr = (dataUrl: string) => {
    setOcrLoading(true);
    setOcrResult(null);
    setShowOcrPanel(false);
    setCinImgError(false);
    setEcartChoix(null);

    const currentCinSaisi = candidat?.cin || cinInput;
    lireCIN(dataUrl, currentCinSaisi).then((res) => {
      setOcrLoading(false);
      setOcrResult(res);
      setOcrEditNom(res.nom);
      setOcrEditCin(res.cin);
    });
  };

  const handleConfirmerPieceCin = () => {
    const cleanNom = ocrEditNom.trim();
    const cleanCin = ocrEditCin.trim().toUpperCase();

    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.nom = cleanNom;
      curCandidat.cin = cleanCin;
      persistCandidate(curCandidat);
      setCandidat(curCandidat);
      setCinInput(cleanCin);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
    } catch {
      // safe fallback
    }

    handleUpdatePiece('CIN', {
      statut: 'prouvee',
      ocrResultat: ocrResult || undefined,
    });

    setShowOcrPanel(false);
    setOcrResult(null);
  };

  const handleRefairePhoto = () => {
    setShowOcrPanel(false);
    setOcrResult(null);
    setOcrLoading(false);
    setActiveCameraPiece('CIN');
  };

  const handleFileUpload = (type: PieceType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fichier > 2 Mo refusé avec le message « Fichier trop lourd (2 Mo max) », état inchangé
    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMessage({ type: 'error', text: fr.dossier.fileTooHeavy });
      e.target.value = '';
      return;
    }

    setFeedbackMessage(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    const reader = new FileReader();
    reader.onload = async () => {
      let result = reader.result as string;
      if (!isPdf && (file.type.startsWith('image/') || result.startsWith('data:image'))) {
        result = await compressImageDataUrl(result);
      }
      if (type.toUpperCase() === 'CIN') {
        handleUpdatePiece(type, {
          statut: 'declaree',
          source: 'televersement',
          fichier: result,
        });
        demarrerOcr(result);
      } else {
        handleUpdatePiece(type, {
          statut: 'prouvee',
          source: 'televersement',
          fichier: result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCaptureSuccess = (dataUrl: string) => {
    if (activeCameraPiece) {
      if (activeCameraPiece.toUpperCase() === 'CIN') {
        handleUpdatePiece(activeCameraPiece, {
          statut: 'declaree',
          source: 'camera',
          fichier: dataUrl,
        });
        setActiveCameraPiece(null);
        demarrerOcr(dataUrl);
      } else {
        handleUpdatePiece(activeCameraPiece, {
          statut: 'prouvee',
          source: 'camera',
          fichier: dataUrl,
        });
        setActiveCameraPiece(null);
      }
    }
  };

  const handleCameraErrorFallback = (pieceType: PieceType | null) => {
    const targetType = pieceType;
    setActiveCameraPiece(null);
    setFeedbackMessage({
      type: 'warning',
      text: fr.dossier.cameraUnavailable,
    });
    if (targetType) {
      setTimeout(() => {
        fileInputRefs.current[targetType]?.click();
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
        text: `${fr.dossier.diplomeFound} ${intitule}`,
      });
      handleUpdatePiece('DIPLOME', {
        statut: 'prouvee',
        source: 'apogee',
        fichier: intitule,
      });
    } else {
      setApogeeMessage({
        type: 'error',
        text: fr.dossier.cneUnknown,
      });
    }
  };

  const handleSaveCin = () => {
    const cleanCin = cinInput.trim().toUpperCase();
    if (cleanCin && !/^[A-Z]{1,2}[0-9]{5,6}$/.test(cleanCin)) {
      setCinMessage({
        type: 'error',
        text: fr.dossier.cinFormatError,
      });
      return;
    }
    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      curCandidat.cin = cleanCin || undefined;
      persistCandidate(curCandidat);
      setCandidat(curCandidat);
      setCinMessage({
        type: 'success',
        text: fr.dossier.cinSaved,
      });
      setTimeout(() => setCinMessage(null), 2500);
      window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
    } catch {
      // safe fallback
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
        guichet: Boolean(curCandidat.dossier?.guichet ?? guichet),
        guichetStatut: curCandidat.dossier?.guichetStatut,
        journalGuichet: curCandidat.dossier?.journalGuichet,
        saisiPar: curCandidat.dossier?.saisiPar,
        saisiLe: curCandidat.dossier?.saisiLe,
        consentementGuichet: curCandidat.dossier?.consentementGuichet,
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

  const handleToggleGuichet = (newGuichet: boolean) => {
    try {
      const curCandidat = resolveCandidate(candidatId, candidat);
      if (!curCandidat.dossier) {
        curCandidat.dossier = { casParticulier: false, guichet: false };
      }
      curCandidat.dossier.guichet = newGuichet;
      if (newGuichet) {
        curCandidat.dossier.guichetStatut = 'a_contacter';
        const nowIso = new Date().toISOString();
        const curJournal = curCandidat.dossier.journalGuichet || [];
        curCandidat.dossier.journalGuichet = [
          ...curJournal,
          {
            date: nowIso,
            agent: curCandidat.nom || 'Candidat',
            action: 'Demande du candidat',
          },
        ];
      }
      persistCandidate(curCandidat);
      setCandidat(curCandidat);
      setGuichet(newGuichet);
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
  const piecesDeclarees = pieces.filter(
    (p) => p.statut === 'declaree' || p.statut === 'prouvee'
  ).length;
  const piecesProuvees = pieces.filter((p) => p.statut === 'prouvee').length;

  const percentDeclarees = Math.round((piecesDeclarees / 4) * 100);
  const percentProuvees = Math.round((piecesProuvees / 4) * 100);

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
      {/* Bandeau si saisi au guichet par un agent */}
      {candidat?.dossier?.saisiPar && (
        <div className="bg-teal-50 border border-teal-200 text-teal-950 rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
          <UserCheck size={18} className="text-teal-700 shrink-0" />
          <span>
            {fr.dossier.saisiAuGuichetBandeau
              .replace('{agent}', candidat.dossier.saisiPar)
              .replace('{date}', candidat.dossier.saisiLe || '')}
          </span>
        </div>
      )}

      {/* 1. Ligne en haut si peutProuver : bandeau dynamique */}
      {peutProuver && piecesProuvees < 4 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl px-4 py-3 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            {isAdmisPv
              ? fr.dossier.bannerAdmisPreuves
              : fr.dossier.bannerConvoquePreuves}
          </span>
        </div>
      )}

      {/* En haut : deux compteurs « N/4 pièces déclarées » et « N/4 pièces prouvées » avec barres de progression */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
        {/* Ligne 1 : Pièces déclarées */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="text-sm text-emerald-700 font-extrabold">
                {piecesDeclarees}/4
              </span>
              <span>{fr.dossier.piecesDeclarees}</span>
            </div>
            {piecesDeclarees === 4 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={12} />
                <span>Complètes</span>
              </span>
            )}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentDeclarees}%` }}
            />
          </div>
        </div>

        {/* Ligne 2 : Pièces prouvées */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <span className="text-sm text-emerald-700 font-extrabold">
                {piecesProuvees}/4
              </span>
              <span>{fr.dossier.piecesProuvees}</span>
            </div>
            {piecesProuvees === 4 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={12} />
                <span>{fr.dossierModule.allReadyBadge}</span>
              </span>
            )}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-700 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentProuvees}%` }}
            />
          </div>
        </div>
      </div>

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
            pieces.find(
              (p) => p.type === type || p.type.toUpperCase() === type.toUpperCase()
            ) || { type, statut: 'absente' as const };

          const isImage = isImageFile(piece.fichier);
          const isPdf = piece.fichier && piece.fichier.includes('pdf');
          const isDiplome = type === 'DIPLOME' || type === 'diplome';
          const isCin = type === 'CIN' || type === 'cin';
          const isProven = piece.statut === 'prouvee';

          return (
            <div
              key={type}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
            >
              {/* Ligne 1 : Nom de la pièce + Badge(s) */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {getPieceName(type)}
                  </h3>
                  {piece.source && (
                    <p className="text-[10px] text-slate-400">
                      {fr.dossier.sources[piece.source] || piece.source}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Si peutProuver et pièce déclarée : badge « Preuve à fournir » */}
                  {peutProuver && piece.statut === 'declaree' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fr.dossier.preuveAFournir}</span>
                    </span>
                  )}
                  {/* Statut de la pièce : Vérifiée (Apogée) ou Preuve fournie (avec mention Non contrôlée) */}
                  {isProven ? (
                    piece.source === 'apogee' ? (
                      <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2 py-0.5">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{fr.dossier.verifieeApogee}</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs px-2 py-0.5">
                          <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                          <span>{fr.dossier.preuveFournie}</span>
                        </span>
                        {(piece.source === 'camera' || piece.source === 'televersement' || !piece.source) && (
                          <span className="text-xs text-slate-500 font-normal">
                            {fr.dossier.nonControlee}
                          </span>
                        )}
                      </div>
                    )
                  ) : (
                    <StatusBadge type="piece" statut={piece.statut} size="sm" />
                  )}
                </div>
              </div>

              {/* RÈGLE NON PEUT PROUVER : case à cocher « Je déclare avoir cette pièce » + phrase explicative */}
              {!peutProuver && !isProven && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={piece.statut === 'declaree'}
                      onChange={(e) => {
                        const newStatut = e.target.checked ? 'declaree' : 'absente';
                        handleUpdatePiece(type, { statut: newStatut });
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-medium">{fr.dossier.declarePiece}</span>
                  </label>
                  <p className="text-xs text-slate-500 pl-6.5">
                    {candidatResultat?.resultat === 'LISTE_COMPLEMENTAIRE'
                      ? fr.dossier.explicationListeAttente
                      : candidatResultat?.resultat === 'REFUSE'
                      ? fr.dossier.explicationRefuse
                      : fr.dossier.explicationNonValide}
                  </p>
                </div>
              )}

              {/* RÈGLE PEUT PROUVER ET PIÈCE ABSENTE : case à cocher pour déclarer */}
              {peutProuver && piece.statut === 'absente' && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleUpdatePiece(type, { statut: 'declaree' });
                        }
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-medium">{fr.dossier.declarePiece}</span>
                  </label>
                </div>
              )}

              {/* Saisie CIN facultative sur la carte CIN */}
              {isCin && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700">
                    {fr.dossier.cinFieldLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cinInput}
                      onChange={(e) => {
                        setCinInput(e.target.value);
                        setCinMessage(null);
                      }}
                      placeholder={fr.dossier.cinPlaceholder}
                      className="flex-1 min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCin}
                      className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
                    >
                      {fr.dossier.saveCin}
                    </button>
                  </div>
                  {cinMessage && (
                    <p
                      className={`text-[11px] font-medium ${
                        cinMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {cinMessage.text}
                    </p>
                  )}
                </div>
              )}

              {/* État OCR en cours sur la carte CIN */}
              {isCin && ocrLoading && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="font-semibold">{fr.dossier.ocrLectureEnCours}</span>
                </div>
              )}

              {/* Bouton pour afficher les informations extraites après lecture */}
              {isCin && !ocrLoading && ocrResult && !showOcrPanel && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOcrPanel(true)}
                    className="w-full min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
                  >
                    <FileText size={15} />
                    <span>{fr.dossier.ocrAfficherInfos}</span>
                  </button>
                </div>
              )}

              {/* Panneau d'informations extraites OCR */}
              {isCin && showOcrPanel && ocrResult && (() => {
                const cinSaisiRef = (candidat?.cin || cinInput || '').trim().toUpperCase();
                const curCinClean = ocrEditCin.trim().toUpperCase();
                const isCinFormatValid = /^[A-Z]{1,2}[0-9]{5,6}$/.test(curCinClean);
                const hasEcart = Boolean(cinSaisiRef && curCinClean !== cinSaisiRef);
                const isEcartResolu = !hasEcart || ecartChoix === 'lue';

                let ocrDisabledReason: string | null = null;
                if (!ocrEditNom.trim()) {
                  ocrDisabledReason = fr.dossier.ocrNomRequis;
                } else if (!ocrEditCin.trim()) {
                  ocrDisabledReason = fr.dossier.ocrCinRequis;
                } else if (!isCinFormatValid) {
                  ocrDisabledReason = fr.dossier.ocrCinFormatInvalide;
                } else if (hasEcart && !isEcartResolu) {
                  ocrDisabledReason = fr.dossier.ocrEcartNonResolu;
                }

                const isOcrConfirmDisabled = ocrDisabledReason !== null;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {fr.dossier.ocrSimulationAvertissement}
                      </p>
                      {ocrResult.confiance < 0.8 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
                          <AlertCircle size={12} className="shrink-0" />
                          <span>{fr.dossier.ocrAVerifier}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col items-center justify-center p-1 relative shadow-xs">
                        {!cinImgError && piece.fichier ? (
                          <img
                            src={piece.fichier}
                            alt={getPieceName(type)}
                            onError={() => setCinImgError(true)}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 p-1 text-center overflow-hidden">
                            <FileText size={22} className="shrink-0 text-slate-400" />
                            <span className="text-xs text-slate-600 font-medium truncate w-full text-center block">
                              {getPieceName(type)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2 min-w-0">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                            {fr.dossier.ocrChampNom}
                          </label>
                          <input
                            type="text"
                            value={ocrEditNom}
                            onChange={(e) => setOcrEditNom(e.target.value)}
                            className="w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                            {fr.dossier.ocrChampCin}
                          </label>
                          <input
                            type="text"
                            value={ocrEditCin}
                            onChange={(e) => {
                              setOcrEditCin(e.target.value);
                              setEcartChoix(null);
                            }}
                            className="w-full min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                          />
                        </div>
                      </div>
                    </div>

                    {hasEcart && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                          <AlertCircle size={14} className="shrink-0 text-amber-700" />
                          <span>{fr.dossier.ocrEcartNumero}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setOcrEditCin(ocrResult.cin);
                              setEcartChoix('lue');
                            }}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              ecartChoix === 'lue' || curCinClean === ocrResult.cin.toUpperCase()
                                ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                                : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            <div className="text-[10px] text-amber-700 font-medium">{fr.dossier.ocrValeurLue}</div>
                            <div className="font-mono font-bold truncate">{ocrResult.cin}</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOcrEditCin(cinSaisiRef);
                              setEcartChoix('saisie');
                            }}
                            className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                              ecartChoix === 'saisie' || curCinClean === cinSaisiRef
                                ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                                : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            <div className="text-[10px] text-amber-700 font-medium">{fr.dossier.ocrValeurSaisie}</div>
                            <div className="font-mono font-bold truncate">{cinSaisiRef}</div>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmerPieceCin}
                          disabled={isOcrConfirmDisabled}
                          className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                            !isOcrConfirmDisabled
                              ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs active:scale-98'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <CheckCircle2 size={15} />
                          <span>{fr.dossier.ocrConfirmerPiece}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRefairePhoto}
                          className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
                        >
                          <Camera size={15} />
                          <span>{fr.dossier.ocrRefairePhoto}</span>
                        </button>
                      </div>

                      {ocrDisabledReason && (
                        <p className="text-xs text-amber-700 font-medium text-center">
                          {ocrDisabledReason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Champ CNE existant (avec consentement) sur la carte DIPLOME */}
              {isDiplome && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={apogeeCne}
                      onChange={(e) => {
                        setApogeeCne(e.target.value);
                        setApogeeMessage(null);
                      }}
                      placeholder={fr.dossier.cnePlaceholder}
                      className="flex-1 min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyApogee}
                      disabled={!apogeeCne.trim() || !apogeeConsent}
                      className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        apogeeCne.trim() && apogeeConsent
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {fr.dossier.verify}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={apogeeConsent}
                      onChange={(e) => {
                        setApogeeConsent(e.target.checked);
                        setApogeeMessage(null);
                      }}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>{fr.dossier.apogeeConsent}</span>
                  </label>

                  {(!apogeeConsent || !apogeeCne.trim()) && (
                    <p className="text-sm text-slate-500">
                      {!apogeeConsent
                        ? fr.dossier.consentRequiredReason
                        : fr.dossier.cneRequiredReason}
                    </p>
                  )}

                  {apogeeMessage && (
                    <p
                      className={`text-[11px] font-medium ${
                        apogeeMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {apogeeMessage.text}
                    </p>
                  )}
                </div>
              )}

              {/* Pièce 'prouvee' (CIN, diplôme Apogée, etc.) : aperçu + boutons Voir et Remplacer */}
              {isProven && !showOcrPanel && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    {/* Miniature ou résumé */}
                    {isImage && piece.fichier ? (
                      <div className="flex items-center gap-2">
                        {!provenCinImgError ? (
                          <img
                            src={piece.fichier}
                            alt={getPieceName(type)}
                            onClick={() => setViewingPiece(piece)}
                            onError={() => {
                              if (isCin) setProvenCinImgError(true);
                            }}
                            className="w-16 h-11 object-cover rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div
                            onClick={() => setViewingPiece(piece)}
                            className="w-16 h-11 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-1 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <FileText size={16} className="text-slate-400" />
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[130px]">
                          {piece.source === 'camera' ? 'Photo prise' : 'Fichier image'}
                        </span>
                      </div>
                    ) : isDiplome && piece.source === 'apogee' ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                        <Award size={14} className="text-emerald-700 shrink-0" />
                        <span className="truncate font-semibold">{piece.fichier || fr.dossier.apogeeDiplomeTitle}</span>
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
                        onClick={() => setViewingPiece(piece)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                      >
                        <Eye size={13} className="text-slate-500" />
                        <span>{fr.dossier.btnVoirPiece}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleUpdatePiece(type, { statut: 'declaree' });
                          if (isCin) {
                            setShowOcrPanel(false);
                            setOcrResult(null);
                            setOcrLoading(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1 active:scale-98"
                      >
                        <RotateCcw size={13} className="text-rose-600" />
                        <span>{fr.dossier.btnRemplacerPiece}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* RÈGLE PEUT PROUVER : boutons visibles pour chaque pièce au statut 'declaree' */}
              {peutProuver && piece.statut === 'declaree' && (!isCin || (!showOcrPanel && !ocrLoading)) && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCameraPiece(type)}
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

                    {/* Input fichier caché */}
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

      {/* 4. SAISIE ASSISTÉE AU GUICHET (secours papier) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        {guichet ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-700 shrink-0" />
              <span className="text-xs font-bold text-amber-900">
                {fr.dossier.guichetBanner}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleGuichet(false)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              {fr.dossier.cancel}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleToggleGuichet(true)}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer active:scale-98 text-center"
            >
              {fr.dossier.guichetButton}
            </button>
            <p className="text-xs text-slate-500 text-center">
              {fr.dossier.guichetHelp}
            </p>
          </div>
        )}
      </div>

      {/* Modal Caméra */}
      {activeCameraPiece && (
        <CameraCapture
          title={getPieceName(activeCameraPiece)}
          onCapture={handleCaptureSuccess}
          onClose={() => setActiveCameraPiece(null)}
          onErrorFallback={() => handleCameraErrorFallback(activeCameraPiece)}
        />
      )}

      {/* Modal Aperçu Agrandie (Voir) */}
      {viewingPiece && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* En-tête modal */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <Eye size={16} className="text-emerald-700 shrink-0" />
                <h3 className="text-xs font-bold text-slate-900 truncate">
                  {getPieceName(viewingPiece.type)}
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
              {isImageFile(viewingPiece.fichier) ? (
                <img
                  src={viewingPiece.fichier}
                  alt={getPieceName(viewingPiece.type)}
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-xl border border-slate-300 shadow-md bg-white"
                />
              ) : viewingPiece.source === 'apogee' ? (
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
                    {viewingPiece.fichier || 'Master / Diplôme certifié USMBA'}
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
                      {viewingPiece.fichier?.startsWith('data:')
                        ? 'document_televerse.pdf'
                        : (viewingPiece.fichier || 'document.pdf')}
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
      )}
    </div>
  );
};
