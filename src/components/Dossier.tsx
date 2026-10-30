import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Piece, PieceType, Candidat, MotifCasParticulier } from '../types';
import { ApogeeFictif } from '../data/mockData';
import { StatusBadge } from './StatusBadge';
import { CameraCapture } from './CameraCapture';
import { fr } from '../i18n/fr';

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
    statut: 'prouvee',
    source: 'camera',
    fichier:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" rx="10" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><rect x="20" y="25" width="80" height="100" rx="6" fill="%23cbd5e1"/><text x="120" y="55" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f172a">ROYAUME DU MAROC</text><text x="120" y="80" font-family="sans-serif" font-size="12" fill="%23334155">CIN: CD789123</text><text x="120" y="105" font-family="sans-serif" font-size="12" fill="%23334155">Nom: EL FASSI</text><text x="120" y="130" font-family="sans-serif" font-size="12" fill="%23334155">Pr&eacute;nom: Yassine</text></svg>',
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

export const Dossier: React.FC = () => {
  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [activeCameraPiece, setActiveCameraPiece] = useState<PieceType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null);
  const [apogeeCne, setApogeeCne] = useState<string>('');
  const [apogeeConsent, setApogeeConsent] = useState<boolean>(false);
  const [apogeeMessage, setApogeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cas particulier & Guichet state
  const [casParticulier, setCasParticulier] = useState<boolean>(false);
  const [motif, setMotif] = useState<MotifCasParticulier | ''>('');
  const [motifAutre, setMotifAutre] = useState<string>('');
  const [guichet, setGuichet] = useState<boolean>(false);
  const [saveCasSuccess, setSaveCasSuccess] = useState<boolean>(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Charger le candidat et ses données depuis le localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      if (raw) {
        const parsed: Candidat = JSON.parse(raw);
        setCandidat(parsed);
        if (parsed.cne) {
          setApogeeCne(parsed.cne);
        }
        if (parsed.dossier) {
          setCasParticulier(Boolean(parsed.dossier.casParticulier));
          setMotif(parsed.dossier.motif || '');
          setMotifAutre(parsed.dossier.motifAutre || '');
          setGuichet(Boolean(parsed.dossier.guichet));
        }
        if (parsed.pieces && Array.isArray(parsed.pieces) && parsed.pieces.length === 4) {
          setPieces(parsed.pieces);
          return;
        }

        // Si c'est le profil démo Yassine sans pièces encore initialisées
        const isYassine =
          parsed.id === 'cand-001' ||
          parsed.cne === 'N138249871' ||
          parsed.nom?.toLowerCase().includes('yassine');

        const initialList = isYassine ? YASSINE_INITIAL_PIECES : DEFAULT_PIECES;
        parsed.pieces = initialList;
        localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(parsed));
        setPieces(initialList);
        return;
      }
    } catch {
      // safe fallback
    }
    setPieces(YASSINE_INITIAL_PIECES);
  }, []);

  // Détection candidat retenu : au moins une candidature avec statut 'retenue'
  const isRetenu = Boolean(
    candidat?.candidaturesStatuts &&
    Object.values(candidat.candidaturesStatuts).some((s) => s === 'retenue')
  );

  const savePieces = (updatedPieces: Piece[]): boolean => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      const curCandidat: Candidat = raw ? JSON.parse(raw) : (candidat || {});
      curCandidat.pieces = updatedPieces;
      localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(curCandidat));
      setPieces(updatedPieces);
      setCandidat(curCandidat);
      setFeedbackMessage(null);
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
    const updated = pieces.map((p) => {
      if (p.type === type || p.type.toUpperCase() === type.toUpperCase()) {
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
      handleUpdatePiece(type, {
        statut: 'prouvee',
        source: 'televersement',
        fichier: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCaptureSuccess = (dataUrl: string) => {
    if (activeCameraPiece) {
      handleUpdatePiece(activeCameraPiece, {
        statut: 'prouvee',
        source: 'camera',
        fichier: dataUrl,
      });
      setActiveCameraPiece(null);
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

  // Validation cas particulier : motif obligatoire si activé, et si 'AUTRE', champ texte obligatoire
  const isCasParticulierValid =
    !casParticulier || (motif !== '' && (motif !== 'AUTRE' || motifAutre.trim().length > 0));

  const handleSaveCasParticulier = () => {
    if (!isCasParticulierValid) return;
    try {
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      const curCandidat: Candidat = raw ? JSON.parse(raw) : (candidat || {});
      curCandidat.dossier = {
        casParticulier,
        motif: casParticulier && motif ? (motif as MotifCasParticulier) : undefined,
        motifAutre: casParticulier && motif === 'AUTRE' ? motifAutre.trim() : undefined,
        guichet: Boolean(curCandidat.dossier?.guichet ?? guichet),
      };
      localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(curCandidat));
      setCandidat(curCandidat);
      setSaveCasSuccess(true);
      setTimeout(() => setSaveCasSuccess(false), 2500);
      setFeedbackMessage(null);
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
      const raw = localStorage.getItem('usmba_doctorat_candidat');
      const curCandidat: Candidat = raw ? JSON.parse(raw) : (candidat || {});
      if (!curCandidat.dossier) {
        curCandidat.dossier = { casParticulier: false, guichet: false };
      }
      curCandidat.dossier.guichet = newGuichet;
      localStorage.setItem('usmba_doctorat_candidat', JSON.stringify(curCandidat));
      setCandidat(curCandidat);
      setGuichet(newGuichet);
      setFeedbackMessage(null);
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

  // Compteur et progression : basés sur statut 'prouvee'
  const piecesPretes = pieces.filter((p) => p.statut === 'prouvee').length;
  const progressPercent = Math.round((piecesPretes / 4) * 100);

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
      {/* 1. Ligne en haut si Retenu : « Tu es retenu : fournis les preuves manquantes » */}
      {isRetenu && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl px-4 py-3 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{fr.dossier.retenuBanner}</span>
        </div>
      )}

      {/* En haut : compteur « N/4 pièces prêtes » + barre de progression */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <span className="text-sm text-emerald-700 font-extrabold">
              {piecesPretes}/4
            </span>
            <span>{fr.dossier.piecesPretes}</span>
          </div>
          {piecesPretes === 4 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={13} />
              <span>{fr.dossierModule.allReadyBadge}</span>
            </span>
          )}
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
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
                  {/* Si retenu et non prouvée : badge « Preuve à fournir » */}
                  {isRetenu && !isProven && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{fr.dossier.preuveAFournir}</span>
                    </span>
                  )}
                  <StatusBadge type="piece" statut={piece.statut} size="sm" />
                </div>
              </div>

              {/* RÈGLE NON RETENU : case à cocher « Je déclare avoir cette pièce » si non prouvée */}
              {!isRetenu && !isProven && (
                <div className="pt-2 border-t border-slate-100">
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
                </div>
              )}

              {/* Apogée simulé (uniquement si retenu ou diplôme prouvé, sur la carte DIPLOME) */}
              {isRetenu && isDiplome && (
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
                      className="flex-1 min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
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

              {/* Aperçu miniature si image (visible si pièce prouvée) */}
              {isProven && isImage && piece.fichier && (
                <div className="pt-1">
                  <img
                    src={piece.fichier}
                    alt={getPieceName(type)}
                    className="w-24 h-16 object-cover rounded-xl border border-slate-200 shadow-xs"
                  />
                </div>
              )}

              {isProven && isPdf && !isImage && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 w-fit">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <span className="text-[11px] font-medium truncate max-w-[180px]">
                    {piece.fichier?.startsWith('data:')
                      ? fr.dossier.pdfDocument
                      : piece.fichier}
                  </span>
                </div>
              )}

              {/* RÈGLE RETENU : les boutons de preuve réapparaissent */}
              {isRetenu && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
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

            {!isCasParticulierValid && (
              <p className="text-[11px] text-rose-600 font-medium">
                {fr.dossier.motifRequiredError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
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
          <button
            type="button"
            onClick={() => handleToggleGuichet(true)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer active:scale-98 text-center"
          >
            {fr.dossier.guichetButton}
          </button>
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
    </div>
  );
};
