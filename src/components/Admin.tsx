import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileCheck2,
  Award,
  Clock,
  UserCheck,
  Building,
  Mail,
  User,
  Shield,
  FileText,
  Eye,
  ExternalLink,
  X,
} from 'lucide-react';
import { Candidat, Compte, EvenementJournal, Piece, PV, UserRole } from '../types';
import { getComptes, MOCK_CANDIDATS, saveComptes } from '../data/mockData';
import { lireJournal, logEvent } from '../utils/journal';
import {
  ajouterNotification,
  persistUnifiedCandidate,
  reconcileCandidateFromStorage,
  trouverCandidat,
} from '../utils/messages';
import { fr } from '../i18n/fr';

export type AdminTab = 'admin_comptes' | 'admin_inscriptions' | 'admin_journal';

interface InscriptionValidationEntry {
  statut: 'validee';
  valideeLe: string;
  valideePar: string;
}

interface AdmittedInscriptionItem {
  candidatId: string;
  nomComplet: string;
  candidatRecord: Candidat | null;
  pieces: Piece[];
  isValidated: boolean;
  valideeLe?: string;
}

const DEMO_NAMES_FALLBACK: Record<string, string> = {
  'cand-001': 'Yassine El Fassi',
  'cand-sara': 'Sara Benjelloun',
  'cand-omar': 'Omar Alami',
};

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

function hasPieceFile(data?: string): boolean {
  return Boolean(data && typeof data === 'string' && data.trim() !== '');
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
    // Ouverture ignorée sans plantage
  }
}

function readInscriptionsValideesMap(): Record<string, InscriptionValidationEntry> {
  try {
    const raw = localStorage.getItem('usmba_inscriptions_validees');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // fallback
  }
  return {};
}

function loadAdmittedInscriptions(): AdmittedInscriptionItem[] {
  const validationsMap = readInscriptionsValideesMap();
  const admittedIds = new Set<string>();

  try {
    const rawPvs = localStorage.getItem('usmba_doctorat_pvs');
    if (rawPvs) {
      const pvs: PV[] = JSON.parse(rawPvs);
      if (Array.isArray(pvs)) {
        pvs.forEach((pv) => {
          if (!pv || pv.remplaceePar) return;
          const isPublished = pv.statut === 'publie' || Boolean(pv.publieLe);
          if (!isPublished) return;
          (pv.resultats || []).forEach((res) => {
            if (res?.resultat === 'ADMIS' && res.candidatId) {
              admittedIds.add(res.candidatId);
            }
          });
        });
      }
    }
  } catch {
    // fallback
  }

  Object.keys(validationsMap).forEach((id) => {
    if (id && validationsMap[id]?.statut === 'validee') {
      admittedIds.add(id);
    }
  });

  // Récupérer l'éventuel candidat actif et ses pièces locales
  let activeCandidate: Candidat | null = null;
  let activePieces: Piece[] = [];
  try {
    const rawCand = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCand) activeCandidate = JSON.parse(rawCand);
  } catch {
    // fallback
  }
  try {
    const rawPieces = localStorage.getItem('usmba_doctorat_pieces');
    if (rawPieces) {
      const parsed = JSON.parse(rawPieces);
      if (Array.isArray(parsed)) activePieces = parsed;
    }
  } catch {
    // fallback
  }

  const storedRecordsById = new Map<string, Candidat>();
  const absorbStored = (cand: Candidat | null | undefined) => {
    if (!cand || !cand.id) return;
    if (cand.inscriptionStatut === 'validee') {
      admittedIds.add(cand.id);
    }
    if (!storedRecordsById.has(cand.id)) {
      storedRecordsById.set(cand.id, cand);
    }
  };

  try {
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      Object.values(overrides).forEach(absorbStored);
    }
  } catch {
    // fallback
  }
  try {
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      if (Array.isArray(accounts)) accounts.forEach(absorbStored);
    }
  } catch {
    // fallback
  }
  try {
    const rawAll = localStorage.getItem('usmba_all_candidates');
    if (rawAll) {
      const all: Candidat[] = JSON.parse(rawAll);
      if (Array.isArray(all)) all.forEach(absorbStored);
    }
  } catch {
    // fallback
  }
  absorbStored(activeCandidate);
  MOCK_CANDIDATS.forEach(absorbStored);

  return Array.from(admittedIds).map((candidatId) => {
    const seed: Candidat = storedRecordsById.get(candidatId) || {
      id: candidatId,
      nom: '',
      cne: '',
      cin: '',
      email: '',
      tel: '',
      panier: [],
      candidatures: [],
      compteCree: false,
    };

    let reconciled = reconcileCandidateFromStorage(seed);

    if (
      activeCandidate &&
      (activeCandidate.id === candidatId ||
        (reconciled.email &&
          activeCandidate.email &&
          reconciled.email.trim().toLowerCase() === activeCandidate.email.trim().toLowerCase()))
    ) {
      const combinedPieces =
        Array.isArray(activePieces) && activePieces.length > 0
          ? activePieces
          : activeCandidate.pieces || [];
      if (combinedPieces.length > 0) {
        reconciled = {
          ...reconciled,
          pieces:
            Array.isArray(reconciled.pieces) && reconciled.pieces.length > 0
              ? reconciled.pieces.map((p) => {
                  const match = combinedPieces.find(
                    (ap) => ap.type?.toUpperCase() === p.type?.toUpperCase()
                  );
                  if (!match) return p;
                  return {
                    ...p,
                    ...match,
                    fichier: match.fichier || p.fichier,
                    fichierVerso: match.fichierVerso || p.fichierVerso,
                  };
                })
              : combinedPieces,
        };
      }
    }

    const fromParts = [reconciled.prenom, reconciled.nomFamille]
      .filter((v) => v && v.trim())
      .join(' ')
      .trim();
    const resolvedFromTrouver = trouverCandidat(candidatId).nom?.trim();
    let nomComplet =
      fromParts ||
      reconciled.nom?.trim() ||
      resolvedFromTrouver ||
      DEMO_NAMES_FALLBACK[candidatId] ||
      '';
    if (!nomComplet || nomComplet.toLowerCase().startsWith('cand-') || nomComplet.startsWith('Candidat (')) {
      nomComplet = DEMO_NAMES_FALLBACK[candidatId] || fr.admin.inscriptions.nonRenseigne;
    }

    const validationEntry = validationsMap[candidatId];
    const isValidated =
      validationEntry?.statut === 'validee' || reconciled.inscriptionStatut === 'validee';

    return {
      candidatId,
      nomComplet,
      candidatRecord: reconciled,
      pieces: Array.isArray(reconciled.pieces) ? reconciled.pieces : [],
      isValidated,
      valideeLe: validationEntry?.valideeLe || reconciled.inscriptionValideeLe,
    };
  });
}

interface AdminProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

const ITEMS_PER_PAGE = 20;

export const Admin: React.FC<AdminProps> = ({ currentTab, onSelectTab }) => {
  const [comptes, setComptes] = useState<Compte[]>(() => getComptes());
  const [journal, setJournal] = useState<EvenementJournal[]>(() => lireJournal());
  const [hasJournalError, setHasJournalError] = useState(false);
  const [inscriptions, setInscriptions] = useState<AdmittedInscriptionItem[]>(() =>
    loadAdmittedInscriptions()
  );
  const [viewingPiece, setViewingPiece] = useState<{ titre: string; fichier: string } | null>(null);
  const [pieceIllisible, setPieceIllisible] = useState(false);

  // Édition des rôles dans l'onglet comptes
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});

  // Modale ou état de refus d'un compte
  const [refusCompteId, setRefusCompteId] = useState<string | null>(null);
  const [motifRefus, setMotifRefus] = useState('');
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtres onglet Journal
  const [filtreRole, setFiltreRole] = useState<string>('all');
  const [filtreAction, setFiltreAction] = useState<string>('all');
  const [page, setPage] = useState<number>(1);

  // Rechargement des données
  const refreshComptes = () => {
    setComptes(getComptes());
  };

  const refreshJournal = () => {
    try {
      const items = lireJournal();
      setJournal(items);
      setHasJournalError(false);
    } catch {
      setJournal([]);
      setHasJournalError(true);
    }
  };

  const refreshInscriptions = () => {
    setInscriptions(loadAdmittedInscriptions());
  };

  useEffect(() => {
    const handleJournalUpdate = () => refreshJournal();
    const handleInscriptionsSync = () => refreshInscriptions();
    const handleStorageSync = () => {
      refreshJournal();
      refreshInscriptions();
    };
    window.addEventListener('gcd_journal_updated', handleJournalUpdate);
    window.addEventListener('usmba_pvs_updated', handleInscriptionsSync);
    window.addEventListener('usmba_inscriptions_updated', handleInscriptionsSync);
    window.addEventListener('usmba_candidat_updated', handleInscriptionsSync);
    window.addEventListener('usmba_pieces_updated', handleInscriptionsSync);
    window.addEventListener('storage', handleStorageSync);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('usmba_pvs_channel');
        channel.onmessage = () => handleInscriptionsSync();
      }
    } catch {}

    return () => {
      window.removeEventListener('gcd_journal_updated', handleJournalUpdate);
      window.removeEventListener('usmba_pvs_updated', handleInscriptionsSync);
      window.removeEventListener('usmba_inscriptions_updated', handleInscriptionsSync);
      window.removeEventListener('usmba_candidat_updated', handleInscriptionsSync);
      window.removeEventListener('usmba_pieces_updated', handleInscriptionsSync);
      window.removeEventListener('storage', handleStorageSync);
      if (channel) channel.close();
    };
  }, []);

  useEffect(() => {
    if (currentTab === 'admin_inscriptions') {
      refreshInscriptions();
    }
  }, [currentTab]);

  // Comptes en attente
  const comptesEnAttente = useMemo(() => {
    return comptes.filter((c) => c.statut === 'en_attente');
  }, [comptes]);

  const inscriptionsEnAttenteCount = useMemo(() => {
    return inscriptions.filter((item) => !item.isValidated).length;
  }, [inscriptions]);

  // Rôle sélectionné pour un compte
  const getRoleForAccount = (c: Compte): UserRole => {
    return selectedRoles[c.id] || c.role;
  };

  const handleRoleChange = (compteId: string, newRole: UserRole) => {
    setSelectedRoles((prev) => ({ ...prev, [compteId]: newRole }));
  };

  // Validation d'un compte
  const handleValiderCompte = (compte: Compte) => {
    const targetRole = getRoleForAccount(compte);
    const updated = comptes.map((c) => {
      if (c.id === compte.id) {
        return {
          ...c,
          statut: 'actif' as const,
          role: targetRole,
        };
      }
      return c;
    });

    saveComptes(updated);
    setComptes(updated);

    const roleLibelle =
      targetRole === 'enseignant'
        ? fr.admin.comptes.roleDirecteur
        : fr.admin.comptes.roleCed;

    logEvent(
      { id: 'admin-scolarite', nom: 'Service Scolarité', role: 'admin' },
      fr.journalActions.compteValide,
      `${compte.nom} (${compte.email})`,
      `Rôle : ${roleLibelle}`
    );

    setFlashMsg({ type: 'success', text: `${compte.nom} : ${fr.admin.comptes.compteValide}` });
    setTimeout(() => setFlashMsg(null), 3500);
  };

  // Ouverture modale refus
  const handleOpenRefus = (compteId: string) => {
    setRefusCompteId(compteId);
    setMotifRefus('');
  };

  // Validation du refus
  const handleConfirmRefus = () => {
    if (!refusCompteId) return;
    const cleanMotif = motifRefus.trim();
    if (cleanMotif.length < 5) return;

    const targetAccount = comptes.find((c) => c.id === refusCompteId);
    if (!targetAccount) return;

    const updated = comptes.map((c) => {
      if (c.id === refusCompteId) {
        return {
          ...c,
          statut: 'refuse' as const,
          motifRefus: cleanMotif,
        };
      }
      return c;
    });

    saveComptes(updated);
    setComptes(updated);

    logEvent(
      { id: 'admin-scolarite', nom: 'Service Scolarité', role: 'admin' },
      fr.journalActions.compteRefuse,
      `${targetAccount.nom} (${targetAccount.email})`,
      `Motif : ${cleanMotif}`
    );

    setFlashMsg({
      type: 'error',
      text: `${targetAccount.nom} : ${fr.admin.comptes.compteRefuse}`,
    });
    setRefusCompteId(null);
    setMotifRefus('');
    setTimeout(() => setFlashMsg(null), 3500);
  };

  const handleValiderInscription = (item: AdmittedInscriptionItem) => {
    if (item.isValidated) return;
    const nowIso = new Date().toISOString();

    try {
      const currentMap = readInscriptionsValideesMap();
      currentMap[item.candidatId] = {
        statut: 'validee',
        valideeLe: nowIso,
        valideePar: 'Service Scolarité',
      };
      localStorage.setItem('usmba_inscriptions_validees', JSON.stringify(currentMap));
    } catch {
      // fallback
    }

    if (item.candidatRecord && item.candidatRecord.compteCree) {
      persistUnifiedCandidate(
        {
          ...item.candidatRecord,
          inscriptionStatut: 'validee',
          inscriptionValideeLe: nowIso,
          inscriptionValideePar: 'Service Scolarité',
        },
        true
      );
    }

    logEvent(
      { id: 'admin-scolarite', nom: 'Service Scolarité', role: 'admin' },
      fr.journalActions.inscriptionValidee,
      item.nomComplet
    );

    ajouterNotification({
      destinataireId: item.candidatId,
      destinataireEmail: item.candidatRecord?.email,
      texte: fr.admin.inscriptions.notifInscriptionValidee,
      type: 'info',
    });

    window.dispatchEvent(new CustomEvent('usmba_inscriptions_updated'));
    window.dispatchEvent(new CustomEvent('usmba_candidat_updated'));
    refreshInscriptions();

    setFlashMsg({
      type: 'success',
      text: `${item.nomComplet} : ${fr.admin.inscriptions.inscriptionValideeToast}`,
    });
    setTimeout(() => setFlashMsg(null), 3500);
  };

  // Formatage de date
  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} à ${d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoStr;
    }
  };

  // Actions distinctes pour le filtre
  const actionsList = useMemo(() => {
    const s = new Set<string>();
    journal.forEach((j) => {
      if (j.action) s.add(j.action);
    });
    return Array.from(s).sort();
  }, [journal]);

  // Filtrage du journal
  const filteredJournal = useMemo(() => {
    return journal.filter((evt) => {
      if (filtreRole !== 'all' && evt.role !== filtreRole) return false;
      if (filtreAction !== 'all' && evt.action !== filtreAction) return false;
      return true;
    });
  }, [journal, filtreRole, filtreAction]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredJournal.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredJournal.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJournal, currentPage]);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Shield size={10} />
            {fr.auth.roleAdminBadge}
          </span>
        );
      case 'directeur_ced':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
            {fr.auth.roleCedBadge}
          </span>
        );
      case 'enseignant':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            {fr.auth.roleEnseignantBadge}
          </span>
        );
      case 'candidat':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {fr.auth.roleCandidatBadge}
          </span>
        );
      case 'doctorant':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            {fr.auth.roleDoctorantBadge}
          </span>
        );
      case 'agent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {fr.auth.roleAgentBadge}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête Espace Scolarité */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-900/60 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">{fr.admin.title}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {fr.auth.roleAdminBadge}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{fr.admin.subtitle}</p>
          </div>
        </div>

        {/* Boutons d'onglets */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('admin_comptes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'admin_comptes'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Users size={14} />
            <span>{fr.admin.tabs.comptes}</span>
            {comptesEnAttente.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 tabular-nums">
                {comptesEnAttente.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('admin_inscriptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'admin_inscriptions'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Award size={14} />
            <span>{fr.admin.tabs.inscriptions}</span>
            {inscriptionsEnAttenteCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 tabular-nums">
                {inscriptionsEnAttenteCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('admin_journal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              currentTab === 'admin_journal'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <FileText size={14} />
            <span>{fr.admin.tabs.journal}</span>
          </button>
        </div>
      </div>

      {/* Message Flash */}
      {flashMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 transition ${
            flashMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {flashMsg.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 text-rose-600" />
          )}
          <span>{flashMsg.text}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* ONGLET 1 : COMPTES EN ATTENTE                                       */}
      {/* =================================================================== */}
      {currentTab === 'admin_comptes' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {fr.admin.comptes.titre}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{fr.admin.comptes.sousTitre}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {comptesEnAttente.length} en attente
              </span>
            </div>

            {comptesEnAttente.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-semibold text-slate-600">{fr.admin.comptes.aucunCompte}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comptesEnAttente.map((c) => {
                  const roleCourant = getRoleForAccount(c);

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Informations utilisateur */}
                      <div className="space-y-1.5 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <User size={15} className="text-purple-700" />
                          <h4 className="text-xs font-bold text-slate-900">{c.nom}</h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            En attente
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail size={13} className="text-slate-400" />
                          <span className="font-mono text-[11px]">{c.email}</span>
                        </div>
                        {/* Structure en lecture seule */}
                        <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                          <Building size={13} className="text-slate-500 shrink-0" />
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                              {fr.admin.comptes.colStructure}
                            </span>
                            <span className="font-semibold text-[11px] text-slate-800">
                              {c.structure}
                              {c.etablissement ? ` • ${c.etablissement}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sélecteur de rôle & Décision */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* Menu de rôle */}
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-500 mb-1">
                            {fr.admin.comptes.colRole}
                          </label>
                          <select
                            value={roleCourant}
                            onChange={(e) => handleRoleChange(c.id, e.target.value as UserRole)}
                            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-600 cursor-pointer"
                          >
                            <option value="enseignant">{fr.admin.comptes.roleDirecteur}</option>
                            <option value="directeur_ced">{fr.admin.comptes.roleCed}</option>
                          </select>
                        </div>

                        {/* Boutons Valider / Refuser */}
                        <div className="flex items-center gap-2 sm:self-end">
                          <button
                            type="button"
                            onClick={() => handleValiderCompte(c)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <CheckCircle2 size={14} />
                            <span>{fr.admin.comptes.btnValider}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRefus(c.id)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <XCircle size={14} />
                            <span>{fr.admin.comptes.btnRefuser}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modale de motif de refus si activée */}
          {refusCompteId && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
            >
              <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={18} />
                  <h3 className="text-xs font-bold uppercase tracking-wide">
                    {fr.admin.comptes.confirmRefus}
                  </h3>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    {fr.admin.comptes.motifPlaceholder}
                  </label>
                  <textarea
                    rows={3}
                    value={motifRefus}
                    onChange={(e) => setMotifRefus(e.target.value)}
                    placeholder="Ex: Justificatif de rattachement au laboratoire manquant ou invalide"
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  />
                  {motifRefus.trim().length > 0 && motifRefus.trim().length < 5 && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {fr.admin.comptes.motifTooShort} ({motifRefus.trim().length}/5)
                    </p>
                  )}
                  {motifRefus.trim().length === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {fr.admin.comptes.motifTooShort}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRefusCompteId(null);
                      setMotifRefus('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={motifRefus.trim().length < 5}
                    onClick={handleConfirmRefus}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
                      motifRefus.trim().length < 5
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-rose-700 hover:bg-rose-800 text-white active:scale-95 cursor-pointer'
                    }`}
                  >
                    {fr.admin.comptes.btnRefuser}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* ONGLET 2 : JOURNAL D'AUDIT IMMUABLE                                 */}
      {/* =================================================================== */}
      {currentTab === 'admin_journal' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span>{fr.admin.journal.titre}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                    {filteredJournal.length} {filteredJournal.length > 1 ? 'entrées' : 'entrée'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{fr.admin.journal.sousTitre}</p>
              </div>

              {/* Filtres rôle et action */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                  <Filter size={12} className="text-slate-400 shrink-0" />
                  <select
                    value={filtreRole}
                    onChange={(e) => {
                      setFiltreRole(e.target.value);
                      setPage(1);
                    }}
                    className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{fr.admin.journal.tousRoles}</option>
                    <option value="admin">{fr.auth.roleAdminBadge}</option>
                    <option value="enseignant">{fr.auth.roleEnseignantBadge}</option>
                    <option value="directeur_ced">{fr.auth.roleCedBadge}</option>
                    <option value="candidat">{fr.auth.roleCandidatBadge}</option>
                    <option value="doctorant">{fr.auth.roleDoctorantBadge}</option>
                    <option value="agent">{fr.auth.roleAgentBadge}</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                  <select
                    value={filtreAction}
                    onChange={(e) => {
                      setFiltreAction(e.target.value);
                      setPage(1);
                    }}
                    className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    <option value="all">{fr.admin.journal.toutesActions}</option>
                    {actionsList.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Erreur de lecture / corruption */}
            {hasJournalError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-700 shrink-0" />
                <span>{fr.admin.journal.corruptedError}</span>
              </div>
            )}

            {/* Tableau du journal */}
            {paginatedEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Clock size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="font-semibold text-slate-600">{fr.admin.journal.aucunEvenement}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {paginatedEvents.map((evt) => {
                  const isCandidatureValidee = evt.action.includes('Candidature validée');
                  const isScanDepose = evt.action.includes('Scan du PV déposé');

                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs"
                    >
                      {/* Horodatage & Acteur */}
                      <div className="flex items-start md:items-center gap-2.5 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">
                            {formatDateTime(evt.date)}
                          </span>
                          <span className="font-bold text-slate-900 mt-0.5">{evt.acteurNom}</span>
                        </div>
                        <div>{getRoleBadge(evt.role)}</div>
                      </div>

                      {/* Action & Spécificités (icônes / Remise papier) */}
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        {isCandidatureValidee && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Award size={12} className="text-emerald-600" />
                            <span>{evt.action}</span>
                          </span>
                        )}

                        {isScanDepose && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <FileCheck2 size={12} className="text-sky-600" />
                            <span>{evt.action}</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-sky-600 text-white uppercase tracking-wider">
                              {fr.admin.journal.remisePapier}
                            </span>
                          </span>
                        )}

                        {!isCandidatureValidee && !isScanDepose && (
                          <span className="font-semibold text-slate-800">{evt.action}</span>
                        )}

                        {/* Cible et Détail */}
                        {evt.cible && (
                          <span className="text-slate-600 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md">
                            {evt.cible}
                          </span>
                        )}

                        {evt.detail && (
                          <span className="text-slate-500 italic text-[11px]">
                            ({evt.detail})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination "Page x/y par 20" */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  {fr.admin.journal.page} <strong className="text-slate-900">{currentPage}</strong>{' '}
                  {fr.admin.journal.sur} <strong className="text-slate-900">{totalPages}</strong>{' '}
                  (20 par page)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      currentPage <= 1
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95'
                    }`}
                  >
                    <ChevronLeft size={14} />
                    <span>{fr.admin.journal.precedent}</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                      currentPage >= totalPages
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95'
                    }`}
                  >
                    <span>{fr.admin.journal.suivant}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ONGLET 3 : VALIDATION DES INSCRIPTIONS (CIN, DIPLÔME, RELEVÉS)      */}
      {/* =================================================================== */}
      {currentTab === 'admin_inscriptions' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {fr.admin.inscriptions.titre}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{fr.admin.inscriptions.sousTitre}</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                {inscriptionsEnAttenteCount} en attente
              </span>
            </div>

            {inscriptions.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Award size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="font-semibold text-slate-600">{fr.admin.inscriptions.aucunCandidat}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inscriptions.map((item) => {
                  const cinPiece = item.pieces.find((p) => p.type?.toUpperCase() === 'CIN');
                  const diplomePiece = item.pieces.find((p) => p.type?.toUpperCase() === 'DIPLOME');
                  const relevesPiece = item.pieces.find((p) => p.type?.toUpperCase() === 'RELEVES');

                  const hasCinRecto = hasPieceFile(cinPiece?.fichier);
                  const hasCinVerso = hasPieceFile(cinPiece?.fichierVerso);
                  const cinOk = hasCinRecto && hasCinVerso;
                  const diplomeOk = hasPieceFile(diplomePiece?.fichier);
                  const relevesOk = hasPieceFile(relevesPiece?.fichier);

                  return (
                    <div
                      key={item.candidatId}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs"
                    >
                      {/* En-tête épuré : uniquement Nom et Prénom + statut */}
                      <div className="px-4 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <User size={16} className="text-slate-600 shrink-0" />
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {item.nomComplet}
                          </h4>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            item.isValidated ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.isValidated ? (
                            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                          ) : (
                            <Clock size={14} className="shrink-0 text-amber-600" />
                          )}
                          <span>
                            {item.isValidated
                              ? fr.admin.inscriptions.badgeValidee
                              : fr.admin.inscriptions.badgeEnAttente}
                          </span>
                        </span>
                      </div>

                      {/* Pièces justificatives : CIN, Diplôme, Relevés */}
                      <div className="divide-y divide-slate-100">
                        {/* CIN */}
                        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {cinOk ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-rose-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block">
                                {fr.admin.inscriptions.cin}
                              </span>
                              <span
                                className={`text-[11px] font-medium ${
                                  cinOk ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {cinOk
                                  ? fr.admin.inscriptions.statutFournie
                                  : hasCinRecto && !hasCinVerso
                                  ? fr.admin.inscriptions.statutVersoManquant
                                  : !hasCinRecto && hasCinVerso
                                  ? fr.admin.inscriptions.statutRectoManquant
                                  : fr.admin.inscriptions.statutManquante}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasCinRecto && cinPiece?.fichier && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPieceIllisible(false);
                                  setViewingPiece({
                                    titre: `${item.nomComplet} — ${fr.admin.inscriptions.cin} (${fr.admin.inscriptions.recto})`,
                                    fichier: cinPiece.fichier!,
                                  });
                                }}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <Eye size={13} className="text-slate-500" />
                                <span>{fr.admin.inscriptions.btnVoirRecto}</span>
                              </button>
                            )}
                            {hasCinVerso && cinPiece?.fichierVerso && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPieceIllisible(false);
                                  setViewingPiece({
                                    titre: `${item.nomComplet} — ${fr.admin.inscriptions.cin} (${fr.admin.inscriptions.verso})`,
                                    fichier: cinPiece.fichierVerso!,
                                  });
                                }}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <Eye size={13} className="text-slate-500" />
                                <span>{fr.admin.inscriptions.btnVoirVerso}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Diplôme */}
                        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {diplomeOk ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-rose-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block">
                                {fr.admin.inscriptions.diplome}
                              </span>
                              <span
                                className={`text-[11px] font-medium ${
                                  diplomeOk ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {diplomeOk
                                  ? fr.admin.inscriptions.statutFournie
                                  : fr.admin.inscriptions.statutManquante}
                              </span>
                            </div>
                          </div>

                          {diplomeOk && diplomePiece?.fichier && (
                            <button
                              type="button"
                              onClick={() => {
                                setPieceIllisible(false);
                                setViewingPiece({
                                  titre: `${item.nomComplet} — ${fr.admin.inscriptions.diplome}`,
                                  fichier: diplomePiece.fichier!,
                                });
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <Eye size={13} className="text-slate-500" />
                              <span>{fr.admin.inscriptions.btnVoir}</span>
                            </button>
                          )}
                        </div>

                        {/* Relevés de notes */}
                        <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {relevesOk ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-rose-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 block">
                                {fr.admin.inscriptions.releves}
                              </span>
                              <span
                                className={`text-[11px] font-medium ${
                                  relevesOk ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {relevesOk
                                  ? fr.admin.inscriptions.statutFournie
                                  : fr.admin.inscriptions.statutManquante}
                              </span>
                            </div>
                          </div>

                          {relevesOk && relevesPiece?.fichier && (
                            <button
                              type="button"
                              onClick={() => {
                                setPieceIllisible(false);
                                setViewingPiece({
                                  titre: `${item.nomComplet} — ${fr.admin.inscriptions.releves}`,
                                  fichier: relevesPiece.fichier!,
                                });
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <Eye size={13} className="text-slate-500" />
                              <span>{fr.admin.inscriptions.btnVoir}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pied de carte : Bouton Valider l'inscription */}
                      <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
                        {item.isValidated ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            <span>
                              {fr.admin.inscriptions.badgeValidee}
                              {item.valideeLe
                                ? ` · ${new Date(item.valideeLe).toLocaleDateString('fr-FR')}`
                                : ''}
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleValiderInscription(item)}
                            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
                          >
                            <UserCheck size={15} />
                            <span>{fr.admin.inscriptions.btnValider}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aperçu plein écran CIN / Diplôme / Relevés */}
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
                  <span>{fr.admin.inscriptions.ouvrirNouvelOnglet}</span>
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
              aria-label={fr.admin.inscriptions.fermerApercu}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto">
            {pieceIllisible ? (
              <div className="text-center p-8 bg-slate-900 rounded-2xl text-rose-400 font-medium border border-rose-950">
                <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
                <p>{fr.admin.inscriptions.fichierIllisible}</p>
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
                <p>{fr.admin.inscriptions.fichierIllisible}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
