import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  MessageSquare,
  Award,
  Plus,
  Trash2,
  User,
  ShieldCheck,
  RotateCcw,
  Upload,
  Download,
  Eye,
  ExternalLink,
  X,
  Printer,
} from 'lucide-react';
import { Rapport, RapportStatut } from '../types';
import { INITIAL_RAPPORTS, DEMO_DOCTORANT_NADIA } from '../data/mockData';
import { fr } from '../i18n/fr';

const STORAGE_KEY_RAPPORTS = 'usmba_doctorat_rapports';

function isPdfData(data?: string): boolean {
  if (!data || typeof data !== 'string') return false;
  return data.startsWith('data:application/pdf') || data.toLowerCase().endsWith('.pdf');
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

interface RapportComponentProps {
  doctorantId?: string;
  initialTab?: 'rapport' | 'suivi';
}

export const RapportComponent: React.FC<RapportComponentProps> = ({
  doctorantId = 'doc-nadia',
  initialTab = 'rapport',
}) => {
  const [activeTab, setActiveTab] = useState<'rapport' | 'suivi'>(initialTab);
  const [allRapports, setAllRapports] = useState<Rapport[]>([]);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form & File states
  const [titre, setTitre] = useState('');
  const [avancement, setAvancement] = useState('');
  const [publications, setPublications] = useState<{ titre: string; doi?: string }[]>([]);
  const [communications, setCommunications] = useState<{ titre: string; lieu?: string }[]>([]);
  const [formationsHeures, setFormationsHeures] = useState<number>(0);
  const [perspectives, setPerspectives] = useState('');
  const [aucuneActivite, setAucuneActivite] = useState(false);
  const [fichierPdf, setFichierPdf] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingRapport, setViewingRapport] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RAPPORTS) || localStorage.getItem('usmba_rapports');
      let list: Rapport[] = raw ? JSON.parse(raw) : INITIAL_RAPPORTS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(INITIAL_RAPPORTS));
        localStorage.setItem('usmba_rapports', JSON.stringify(INITIAL_RAPPORTS));
      }
      setAllRapports(list);

      let current = list.find((r) => r.doctorantId === doctorantId);
      if (!current) {
        // Créer un rapport initial en brouillon si aucun n'existe pour Nadia
        current = {
          id: `rap-${doctorantId}-2026`,
          doctorantId,
          encadrantId: DEMO_DOCTORANT_NADIA.encadrantId,
          annee: DEMO_DOCTORANT_NADIA.annee,
          titre: DEMO_DOCTORANT_NADIA.sujetTitre,
          avancement: '',
          publications: [],
          communications: [],
          formationsHeures: 0,
          perspectives: '',
          aucuneActivite: false,
          statut: 'brouillon',
          commentaires: [],
          chronologie: [
            {
              date: new Date().toLocaleDateString('fr-FR'),
              acteur: 'Doctorante (Nadia Alaoui)',
              action: 'Création du dossier de réinscription',
            },
          ],
        };
        list = [current, ...list];
        localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(list));
        localStorage.setItem('usmba_rapports', JSON.stringify(list));
      }

      setRapport(current);
      setTitre(current.titre || DEMO_DOCTORANT_NADIA.sujetTitre);
      setAvancement(current.avancement || '');
      setPublications(current.publications || []);
      setCommunications(current.communications || []);
      setFormationsHeures(current.formationsHeures || 0);
      setPerspectives(current.perspectives || '');
      setAucuneActivite(Boolean(current.aucuneActivite));
      setFichierPdf(current.fichierPdf || null);
      setNomFichier(current.nomFichier || null);
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_rapports_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_rapports_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [doctorantId]);

  const saveRapportToStorage = (updatedRapport: Rapport, toast?: string) => {
    try {
      const updatedList = allRapports.map((r) =>
        r.id === updatedRapport.id ? updatedRapport : r
      );
      if (!allRapports.some((r) => r.id === updatedRapport.id)) {
        updatedList.push(updatedRapport);
      }
      localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(updatedList));
      localStorage.setItem('usmba_rapports', JSON.stringify(updatedList));
      setAllRapports(updatedList);
      setRapport(updatedRapport);
      if (toast) {
        setToastMsg(toast);
        setTimeout(() => setToastMsg(null), 3500);
      }
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      return true;
    } catch {
      return false;
    }
  };

  if (!rapport) return null;

  // Verrouillage : modifiable uniquement si 'brouillon' ou 'a_corriger'
  const isEditable = rapport.statut === 'brouillon' || rapport.statut === 'a_corriger';
  const canSubmit = isEditable && Boolean(fichierPdf);

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    const MAX_SIZE = 1.5 * 1024 * 1024; // 1.5 Mo max
    if (file.size > MAX_SIZE) {
      setUploadError(fr.reinscription.fichierTropLourd);
      return;
    }
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Le fichier doit être au format PDF.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFichierPdf(dataUrl);
      setNomFichier(file.name);
      setUploadError(null);
      if (rapport) {
        const draft: Rapport = {
          ...rapport,
          fichierPdf: dataUrl,
          nomFichier: file.name,
        };
        saveRapportToStorage(draft);
      }
    };
    reader.onerror = () => {
      setUploadError('Erreur de lecture du fichier PDF.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setFichierPdf(null);
    setNomFichier(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (rapport) {
      const draft: Rapport = {
        ...rapport,
        fichierPdf: undefined,
        nomFichier: undefined,
      };
      saveRapportToStorage(draft);
    }
  };

  // Soumission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !fichierPdf) return;

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const newChrono = [
      ...(rapport.chronologie || []),
      {
        date: todayStr,
        acteur: `Doctorante (${DEMO_DOCTORANT_NADIA.nom})`,
        action:
          rapport.statut === 'a_corriger'
            ? 'Nouvelle soumission du rapport PDF après corrections'
            : 'Téléversement et soumission du rapport annuel de réinscription (PDF)',
      },
    ];

    const updated: Rapport = {
      ...rapport,
      fichierPdf,
      nomFichier: nomFichier || 'rapport_reinscription.pdf',
      statut: 'soumis',
      soumisLe: new Date().toISOString(),
      chronologie: newChrono,
    };

    saveRapportToStorage(updated, fr.reinscription.submittedToast);
  };

  // Indicateur "En attente de"
  const getWaitingActor = (): { label: string; color: string } => {
    switch (rapport.statut) {
      case 'brouillon':
        return { label: fr.reinscription.waitingDoctorant, color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'soumis':
        return { label: fr.reinscription.waitingEncadrant, color: 'text-sky-700 bg-sky-50 border-sky-200' };
      case 'valide_encadrant':
      case 'avis_comite':
        return { label: fr.reinscription.waitingComite, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
      case 'a_corriger':
        return { label: fr.reinscription.waitingDoctorant, color: 'text-rose-700 bg-rose-50 border-rose-200' };
      case 'valide_ced':
        return { label: fr.reinscription.validatedCedNotice, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      default:
        return { label: rapport.statut, color: 'text-slate-700 bg-slate-50 border-slate-200' };
    }
  };

  const waitingInfo = getWaitingActor();

  return (
    <>
      <div className="space-y-4 print:hidden">
      {/* En-tête sobre doctorant */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {fr.reinscription.yearBadge.replace('{annee}', String(DEMO_DOCTORANT_NADIA.annee))}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-300 font-semibold">{DEMO_DOCTORANT_NADIA.structure}</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white mt-1">
              {DEMO_DOCTORANT_NADIA.nom}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {fr.reinscription.encadrantLabel} Pr. Karim El Amrani
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              title={fr.reinscription.btnTelechargerModele}
            >
              <Download size={13} />
              <span>{fr.reinscription.btnTelechargerModele}</span>
            </button>

            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                rapport.statut === 'valide_ced'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : rapport.statut === 'a_corriger'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : rapport.statut === 'soumis'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : rapport.statut === 'avis_comite'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {fr.reinscription.statuts[rapport.statut]}
            </span>
          </div>
        </div>

        {/* Sous-onglets Mon rapport / Suivi */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('rapport')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rapport'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {fr.reinscription.doctorantTabRapport}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suivi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'suivi'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {fr.reinscription.doctorantTabSuivi}
          </button>
        </div>
      </div>

      {/* Toast de confirmation */}
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* BANNIÈRE D'ÉTAT DU DOSSIER */}
      {!isEditable && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-900 flex items-start gap-2.5">
          <Clock size={16} className="text-sky-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{fr.reinscription.lockedBanner}</p>
            <p className="text-[11px] text-sky-700 mt-0.5">
              {fr.reinscription.waitingPrefix} <span className="font-bold">{waitingInfo.label}</span>
            </p>
          </div>
        </div>
      )}

      {rapport.statut === 'a_corriger' && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{fr.reinscription.correctionBanner}</p>
            {rapport.commentaires.length > 0 && (
              <p className="text-[11px] text-rose-800 mt-1 italic">
                « {rapport.commentaires[rapport.commentaires.length - 1].texte} »
              </p>
            )}
          </div>
        </div>
      )}

      {/* CONTENU ONGLETS */}
      {activeTab === 'rapport' ? (
        <div className="space-y-4">
          {/* Étape 1 : Téléchargement du modèle vierge pour remplissage hors ligne */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Modèle officiel de réinscription
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Téléchargez ou imprimez le modèle officiel vierge à remplir hors ligne.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 shrink-0"
              >
                <Printer size={14} />
                <span>{fr.reinscription.btnTelechargerModele}</span>
              </button>
            </div>
          </div>

          {/* Étape 2 : Dépôt du rapport PDF (1,5 Mo max) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Dépôt de votre rapport rempli (PDF)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {fr.reinscription.glisserOuCliquerPdf}
              </p>
            </div>

            {/* Input fichier et zone de téléversement */}
            {isEditable && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="pdf-upload-input"
                />

                {!fichierPdf && (
                  <label
                    htmlFor="pdf-upload-input"
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/30 group"
                  >
                    <Upload size={28} className="text-slate-400 group-hover:text-emerald-600 mb-2 transition" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">
                      {fr.reinscription.btnTeleverserPdf}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      {fr.reinscription.glisserOuCliquerPdf}
                    </span>
                  </label>
                )}

                {uploadError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={15} className="text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fichier PDF présent */}
            {fichierPdf && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {nomFichier || 'rapport_reinscription.pdf'}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={11} /> Document PDF prêt
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingRapport(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Eye size={13} />
                    <span>{fr.reinscription.btnVoir}</span>
                  </button>

                  {isEditable && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title={fr.reinscription.supprimerFichier}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Compatibilité anciens rapports saisis en ligne */}
            {!fichierPdf && (rapport.avancement || rapport.publications?.length || rapport.communications?.length) && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Données de rapport enregistrées en ligne</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRapport(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Eye size={13} />
                  <span>{fr.reinscription.btnVoir}</span>
                </button>
              </div>
            )}

            {/* Étape 3 : Soumission */}
            {isEditable && (
              <div className="pt-3 border-t border-slate-200 flex flex-col items-end">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    canSubmit
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs active:scale-98'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                  <span>{fr.reinscription.btnSubmit}</span>
                </button>
                {!canSubmit && (
                  <span className="text-[11px] text-rose-600 font-semibold mt-1.5">
                    {fr.reinscription.televerseDabord}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ONGLET SUIVI & CHRONOLOGIE */
        <div className="space-y-4">
          {/* Indicateur de statut actif */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Statut actuel :
              </span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {fr.reinscription.statuts[rapport.statut]}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${waitingInfo.color}`}>
              <Clock size={14} />
              <span>{fr.reinscription.waitingPrefix} {waitingInfo.label}</span>
            </div>
          </div>

          {/* Avis du comité (si saisine effectuée) */}
          {rapport.comite && rapport.comite.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {fr.reinscription.comiteVotesSummaryTitle}
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {rapport.comite.map((vote, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{vote.membre}</p>
                      {vote.commentaire && (
                        <p className="text-[11px] text-slate-600 italic mt-0.5">« {vote.commentaire} »</p>
                      )}
                    </div>
                    <div>
                      {vote.avis === 'FAVORABLE' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Favorable
                        </span>
                      ) : vote.avis === 'DEFAVORABLE' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          Défavorable
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          En attente
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronologie commune doctorant / encadrant */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              {fr.reinscription.chronologieTitle}
            </h3>

            <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {(rapport.chronologie || []).map((step, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span className="font-bold text-slate-800">{step.acteur}</span>
                      <span>{step.date}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commentaires des évaluateurs */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              {fr.reinscription.commentairesTitle}
            </h3>
            {rapport.commentaires.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{fr.reinscription.noComments}</p>
            ) : (
              <div className="space-y-2">
                {rapport.commentaires.map((c, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-bold text-slate-800">{c.auteur}</span>
                      <span>{c.date}</span>
                    </div>
                    <p className="text-slate-800 italic">« {c.texte} »</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Visionneuse de document (PDF en iframe + Ouvrir dans un nouvel onglet, ou ancien rapport) */}
      {viewingRapport && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6 overflow-hidden print:hidden">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">
                {fr.reinscription.apercuRapport} — {DEMO_DOCTORANT_NADIA.nom}
              </h3>
              {fichierPdf && isPdfData(fichierPdf) && (
                <button
                  type="button"
                  onClick={() => openPdfInNewTab(fichierPdf)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <ExternalLink size={13} />
                  <span>{fr.dossierDirecteur.ouvrirNouvelOnglet}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewingRapport(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer ml-2"
              aria-label={fr.dossierDirecteur.fermerApercu}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
            {fichierPdf && isPdfData(fichierPdf) ? (
              <iframe
                src={fichierPdf}
                title={nomFichier || 'Rapport PDF'}
                className="w-full h-full min-h-[75vh] rounded-xl bg-white border border-slate-800 shadow-xl"
              />
            ) : (rapport.avancement || rapport.titre || (rapport.publications && rapport.publications.length > 0)) ? (
              <div className="w-full max-w-2xl bg-white text-slate-800 rounded-xl p-6 shadow-xl max-h-[80vh] overflow-y-auto space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">{rapport.annee}ᵉ année de doctorat</span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{rapport.titre}</h4>
                </div>
                {rapport.avancement && (
                  <div>
                    <span className="text-xs font-bold text-slate-900">{fr.reinscription.avancementLabel} :</span>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{rapport.avancement}</p>
                  </div>
                )}
                {rapport.publications && rapport.publications.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-900">{fr.reinscription.publicationsSectionTitle} :</span>
                    <ul className="list-disc list-inside text-xs text-slate-600 mt-1 space-y-1">
                      {rapport.publications.map((p, i) => (
                        <li key={i}>{p.titre} {p.doi && <span className="text-[11px] text-slate-400 font-mono">({p.doi})</span>}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rapport.communications && rapport.communications.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-900">{fr.reinscription.communicationsSectionTitle} :</span>
                    <ul className="list-disc list-inside text-xs text-slate-600 mt-1 space-y-1">
                      {rapport.communications.map((c, i) => (
                        <li key={i}>{c.titre} {c.lieu && <span className="text-[11px] text-slate-400">({c.lieu})</span>}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rapport.formationsHeures > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-900">{fr.reinscription.formationsHoursLabel} :</span>
                    <p className="text-xs text-slate-600 mt-0.5">{rapport.formationsHeures} h</p>
                  </div>
                )}
                {rapport.perspectives && (
                  <div>
                    <span className="text-xs font-bold text-slate-900">{fr.reinscription.perspectivesLabel} :</span>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{rapport.perspectives}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-slate-400 font-medium border border-slate-800">
                <p>{fr.dossierDirecteur.aucuneDonnee}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modèle officiel vierge pour impression CSS */}
      <div id="modele-impression-vierge" className="hidden print:block text-slate-900 bg-white p-6 font-sans">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <h1 className="text-base font-bold uppercase tracking-wider">{fr.reinscription.modeleImpressionTitre}</h1>
          <h2 className="text-xs font-semibold text-slate-700 mt-1">{fr.reinscription.modeleImpressionSousTitre}</h2>
          <p className="text-[11px] text-slate-500 mt-1 italic">{fr.reinscription.modeleAnneeUniversitaire}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3 text-xs mb-6 bg-slate-50/50">
          <div>
            <span className="font-bold">{fr.reinscription.modeleDoctorantNom}</span> {DEMO_DOCTORANT_NADIA.nom}
          </div>
          <div>
            <span className="font-bold">{fr.reinscription.modeleDoctorantAnnee}</span> {DEMO_DOCTORANT_NADIA.annee}ᵉ année
          </div>
          <div>
            <span className="font-bold">{fr.reinscription.modeleDirecteurNom}</span> Pr. Karim El Amrani
          </div>
          <div>
            <span className="font-bold">{fr.reinscription.modeleStructure}</span> {DEMO_DOCTORANT_NADIA.structure}
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              1. {fr.reinscription.titreLabel}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[48px] bg-white">
              {titre || DEMO_DOCTORANT_NADIA.sujetTitre}
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              2. {fr.reinscription.publicationsSectionTitle}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[75px] bg-white text-slate-400 italic">
              (Revues, articles acceptés ou parus, DOI...)
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              3. {fr.reinscription.communicationsSectionTitle}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[75px] bg-white text-slate-400 italic">
              (Conférences, congrès, séminaires avec dates et lieux...)
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              4. {fr.reinscription.formationsHoursLabel}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[48px] bg-white text-slate-400 italic">
              Nombre d’heures suivies et intitulés des formations :
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              5. {fr.reinscription.avancementLabel}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[160px] bg-white text-slate-400 italic">
              (État d’avancement des travaux de recherche, résultats obtenus, méthodologies...)
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wide text-slate-900 mb-1">
              6. {fr.reinscription.perspectivesLabel}
            </h3>
            <div className="border border-slate-300 rounded-lg p-3 min-h-[100px] bg-white text-slate-400 italic">
              (Programme prévisionnel de l’année à venir, rédaction d’articles ou de manuscrit...)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300">
            <div className="border border-slate-300 rounded-lg p-4 h-28 flex flex-col justify-between">
              <span className="font-bold text-[11px]">{fr.reinscription.modeleSignatureDoctorant}</span>
              <span className="text-[10px] text-slate-400">Date et signature :</span>
            </div>
            <div className="border border-slate-300 rounded-lg p-4 h-28 flex flex-col justify-between">
              <span className="font-bold text-[11px]">{fr.reinscription.modeleSignatureDirecteur}</span>
              <span className="text-[10px] text-slate-400">Date, avis et signature :</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
