import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  MessageSquare,
  UserCheck,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  KeyRound,
  Check,
  Copy,
  Lock,
} from 'lucide-react';
import { Candidat, GuichetStatut, JournalGuichetEntry } from '../types';
import { MOCK_CANDIDATS, DEMO_AGENT_KARIMA } from '../data/mockData';
import { normaliserTel, lienWhatsApp } from '../utils/messages';
import { Dossier } from './Dossier';
import { fr } from '../i18n/fr';

const AGENT_NAME = DEMO_AGENT_KARIMA.nom; // 'Karima Tazi'

function formatDateFr(isoOrDate?: string): string {
  if (!isoOrDate) return '-';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return `${d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} à ${d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return isoOrDate;
  }
}

function persistCandidateUpdate(cand: Candidat): void {
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
    window.dispatchEvent(new CustomEvent('usmba_pieces_updated'));
  } catch {
    // safe fallback
  }
}

export const Guichet: React.FC = () => {
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null);
  const [consentementChecked, setConsentementChecked] = useState<boolean>(false);
  const [journalOpenMap, setJournalOpenMap] = useState<Record<string, boolean>>({});

  // Note pour "Marquer contacté"
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState<string>('');

  // Création d'un nouveau compte candidat
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newNom, setNewNom] = useState<string>('');
  const [newTel, setNewTel] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTempPassword, setCreatedTempPassword] = useState<{ nom: string; pass: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = () => {
    const map = new Map<string, Candidat>();

    // 1. Mock de base
    MOCK_CANDIDATS.forEach((c) => map.set(c.id, c));

    // 2. Candidat actif
    try {
      const rawCur = localStorage.getItem('usmba_doctorat_candidat');
      if (rawCur) {
        const cur: Candidat = JSON.parse(rawCur);
        map.set(cur.id, cur);
      }
    } catch {}

    // 3. Comptes inscrits
    try {
      const rawAccounts = localStorage.getItem('usmba_registered_accounts');
      if (rawAccounts) {
        const accounts: Candidat[] = JSON.parse(rawAccounts);
        accounts.forEach((c) => map.set(c.id, c));
      }
    } catch {}

    // 4. Overrides
    try {
      const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
      if (rawOverrides) {
        const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
        Object.values(overrides).forEach((c) => map.set(c.id, c));
      }
    } catch {}

    const guichetList = Array.from(map.values()).filter(
      (c) => c.dossier?.guichet || (c.dossier as any)?.traiterAuGuichet
    );

    setCandidats(guichetList);
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_pieces_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_pieces_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const getPiecesCount = (c: Candidat) => {
    const pieces = c.pieces || [];
    const count = pieces.filter((p) => p.statut === 'declaree' || p.statut === 'prouvee').length;
    return count;
  };

  const getStatutBadge = (statut?: GuichetStatut) => {
    const s = statut || 'a_contacter';
    switch (s) {
      case 'saisi':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span>{fr.guichetAgent.statuts.saisi}</span>
          </span>
        );
      case 'venu':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
            <UserCheck size={13} className="text-indigo-600 shrink-0" />
            <span>{fr.guichetAgent.statuts.venu}</span>
          </span>
        );
      case 'contacte':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            <MessageSquare size={13} className="text-sky-600 shrink-0" />
            <span>{fr.guichetAgent.statuts.contacte}</span>
          </span>
        );
      case 'a_contacter':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Clock size={13} className="text-amber-600 shrink-0" />
            <span>{fr.guichetAgent.statuts.a_contacter}</span>
          </span>
        );
    }
  };

  // Action : Marquer contacté
  const handleConfirmContacte = (cand: Candidat) => {
    const nowIso = new Date().toISOString();
    const curJournal = cand.dossier?.journalGuichet || [];
    const updatedJournal: JournalGuichetEntry[] = [
      ...curJournal,
      {
        date: nowIso,
        agent: AGENT_NAME,
        action: fr.guichetAgent.journalActions.contacte,
        note: contactNote.trim() || undefined,
      },
    ];

    const updatedCand: Candidat = {
      ...cand,
      dossier: {
        ...(cand.dossier || { casParticulier: false, guichet: true }),
        guichet: true,
        guichetStatut: 'contacte',
        journalGuichet: updatedJournal,
      },
    };

    persistCandidateUpdate(updatedCand);
    setContactingId(null);
    setContactNote('');
    loadData();
    showToast(fr.guichetAgent.toastStatutMaj);
  };

  // Action : Dossier venu
  const handleMarkVenu = (cand: Candidat) => {
    const nowIso = new Date().toISOString();
    const curJournal = cand.dossier?.journalGuichet || [];
    const updatedJournal: JournalGuichetEntry[] = [
      ...curJournal,
      {
        date: nowIso,
        agent: AGENT_NAME,
        action: fr.guichetAgent.journalActions.venu,
      },
    ];

    const updatedCand: Candidat = {
      ...cand,
      dossier: {
        ...(cand.dossier || { casParticulier: false, guichet: true }),
        guichet: true,
        guichetStatut: 'venu',
        journalGuichet: updatedJournal,
      },
    };

    persistCandidateUpdate(updatedCand);
    loadData();
    showToast(fr.guichetAgent.toastStatutMaj);
  };

  // Action : Terminer la saisie
  const handleTerminerSaisie = (cand: Candidat) => {
    const now = new Date();
    const nowFormatted = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const nowIso = now.toISOString();

    const curJournal = cand.dossier?.journalGuichet || [];
    const updatedJournal: JournalGuichetEntry[] = [
      ...curJournal,
      {
        date: nowIso,
        agent: AGENT_NAME,
        action: fr.guichetAgent.journalActions.saisi,
      },
    ];

    const updatedCand: Candidat = {
      ...cand,
      dossier: {
        ...(cand.dossier || { casParticulier: false, guichet: true }),
        guichet: true,
        guichetStatut: 'saisi',
        saisiPar: AGENT_NAME,
        saisiLe: nowFormatted,
        consentementGuichet: true,
        journalGuichet: updatedJournal,
      },
    };

    persistCandidateUpdate(updatedCand);
    setSelectedCandidatId(null);
    setConsentementChecked(false);
    loadData();
    showToast(fr.guichetAgent.saisieFinaliseeToast);
  };

  // Action : Créer un compte candidat au guichet
  const handleCreateCandidatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNom.trim()) {
      setCreateError('Le nom complet est obligatoire.');
      return;
    }
    if (!newTel.trim()) {
      setCreateError('Le numéro de téléphone est obligatoire.');
      return;
    }

    const normTel = normaliserTel(newTel);
    if (!normTel) {
      setCreateError(fr.guichetAgent.invalidPhoneReason);
      return;
    }

    const tempPassword = `USMBA-${Math.floor(100000 + Math.random() * 900000)}`;
    const newId = `cand-guichet-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newCand: Candidat = {
      id: newId,
      nom: newNom.trim(),
      tel: newTel.trim(),
      email: newEmail.trim().toLowerCase() || `candidat.${Date.now()}@etu.usmba.ac.ma`,
      motDePasse: tempPassword,
      compteCree: true,
      panier: [],
      candidatures: [],
      candidaturesStatuts: {},
      dossier: {
        casParticulier: false,
        guichet: true,
        guichetStatut: 'venu',
        consentementGuichet: false,
        journalGuichet: [
          {
            date: nowIso,
            agent: AGENT_NAME,
            action: fr.guichetAgent.journalActions.compteCree,
          },
        ],
      },
      pieces: [
        { type: 'CIN', statut: 'absente' },
        { type: 'DIPLOME', statut: 'absente' },
        { type: 'RELEVES', statut: 'absente' },
        { type: 'CV', statut: 'absente' },
      ],
    };

    persistCandidateUpdate(newCand);
    loadData();

    setCreatedTempPassword({ nom: newCand.nom, pass: tempPassword });
    setPasswordCopied(false);
    setShowCreateModal(false);
    setNewNom('');
    setNewTel('');
    setNewEmail('');
    setCreateError(null);
    showToast(fr.guichetAgent.toastCompteCree);
  };

  const copyPasswordToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const toggleJournal = (id: string) => {
    setJournalOpenMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Dossier actuellement sélectionné pour saisie
  const selectedCandidat = selectedCandidatId
    ? candidats.find((c) => c.id === selectedCandidatId) || null
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast de notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* En-tête guichet */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {fr.guichetAgent.title}
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              {fr.guichetAgent.badgeAgent} ({AGENT_NAME})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {fr.guichetAgent.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs cursor-pointer active:scale-98 transition shrink-0"
        >
          <Plus size={15} />
          <span>{fr.guichetAgent.btnCreerCompte}</span>
        </button>
      </div>

      {/* Modal : Mot de passe provisoire affiché une seule fois */}
      {createdTempPassword && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-teal-800">
              <KeyRound size={20} className="text-teal-600 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900">
                {fr.guichetAgent.tempPasswordTitle}
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Compte créé pour <strong className="text-slate-900">{createdTempPassword.nom}</strong>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-amber-900 block">
                {fr.guichetAgent.tempPasswordNotice}
              </span>
              <div className="flex items-center justify-between bg-white border border-amber-300 rounded-lg p-2.5 font-mono text-base font-extrabold text-slate-900 tracking-wider">
                <span>{createdTempPassword.pass}</span>
                <button
                  type="button"
                  onClick={() => copyPasswordToClipboard(createdTempPassword.pass)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  title="Copier"
                >
                  {passwordCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-amber-800">
                {fr.guichetAgent.tempPasswordAdvice}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCreatedTempPassword(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            >
              {fr.guichetAgent.btnCompris}
            </button>
          </div>
        </div>
      )}

      {/* Modal : Créer un compte candidat */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {fr.guichetAgent.modalCreateTitle}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {fr.guichetAgent.modalCreateSub}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCandidatSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {fr.guichetAgent.fieldNom}
                </label>
                <input
                  type="text"
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  placeholder={fr.guichetAgent.fieldNomPlaceholder}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {fr.guichetAgent.fieldTel}
                </label>
                <input
                  type="tel"
                  value={newTel}
                  onChange={(e) => setNewTel(e.target.value)}
                  placeholder={fr.guichetAgent.fieldTelPlaceholder}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {fr.guichetAgent.fieldEmail}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={fr.guichetAgent.fieldEmailPlaceholder}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {fr.guichetAgent.btnAnnuler}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white cursor-pointer active:scale-98 shadow-xs"
                >
                  {fr.guichetAgent.btnValiderCreation}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal : Marquer contacté avec note facultative */}
      {contactingId && (() => {
        const targetCand = candidats.find((c) => c.id === contactingId);
        if (!targetCand) return null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-sky-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {fr.guichetAgent.btnMarquerContacte} : {targetCand.nom}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContactingId(null);
                    setContactNote('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {fr.guichetAgent.contacteNoteLabel}
                </label>
                <textarea
                  rows={3}
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  placeholder="Ex : Le candidat viendra demain à 10h avec ses pièces originales..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-600 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setContactingId(null);
                    setContactNote('');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {fr.guichetAgent.btnAnnuler}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmContacte(targetCand)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-700 hover:bg-sky-800 text-white cursor-pointer active:scale-98 shadow-xs"
                >
                  {fr.guichetAgent.btnConfirmerContacte}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CAS OÙ UN DOSSIER EST OUVERT PAR L'AGENT POUR SAISIE */}
      {selectedCandidat && (
        <div className="bg-white border-2 border-teal-600/60 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Saisie assistée : {selectedCandidat.nom}
                </h2>
                {getStatutBadge(selectedCandidat.dossier?.guichetStatut)}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Tél : {selectedCandidat.tel || '-'} {selectedCandidat.cne ? `• CNE : ${selectedCandidat.cne}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTerminerSaisie(selectedCandidat)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer active:scale-98 transition flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>{fr.guichetAgent.btnTerminerSaisie}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCandidatId(null);
                  setConsentementChecked(false);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
              >
                {fr.guichetAgent.btnFermerDossier}
              </button>
            </div>
          </div>

          {/* Case obligatoire « Le candidat a présenté sa CIN et consent à la saisie » */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <label className="flex items-center gap-2.5 text-xs font-bold text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentementChecked}
                onChange={(e) => setConsentementChecked(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <span>{fr.guichetAgent.consentCheckboxLabel}</span>
            </label>

            {!consentementChecked && (
              <p className="text-xs text-rose-700 font-medium pl-6.5 flex items-center gap-1.5">
                <Lock size={13} className="shrink-0 text-rose-600" />
                <span>{fr.guichetAgent.consentRequiredReason}</span>
              </p>
            )}
          </div>

          {/* Si déverrouillé : rendu du composant Dossier */}
          {consentementChecked ? (
            <div className="pt-2">
              <Dossier candidatId={selectedCandidat.id} />
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Lock size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">Dossier verrouillé en lecture / modification</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                {fr.guichetAgent.consentRequiredReason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 1. LISTE DES DOSSIERS AVEC GUICHET = TRUE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Dossiers orientés vers le guichet ({candidats.length})
          </h2>
        </div>

        {candidats.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
            {fr.guichetAgent.emptyList}
          </div>
        ) : (
          <div className="space-y-3">
            {candidats.map((c) => {
              const piecesPretes = getPiecesCount(c);
              const statut = c.dossier?.guichetStatut || 'a_contacter';
              const tel = c.tel;
              const isTelNorm = Boolean(normaliserTel(tel));
              const waLink = lienWhatsApp(tel, fr.guichetAgent.whatsappMessage);
              const journal = c.dossier?.journalGuichet || [];
              const isJournalOpen = Boolean(journalOpenMap[c.id]);

              return (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 transition hover:border-slate-300"
                >
                  {/* Ligne 1 : Nom, Téléphone, Pièces, StatusBadge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{c.nom}</span>
                        {c.cne && <span className="font-mono text-xs text-slate-400">({c.cne})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{tel || fr.guichetAgent.missingPhoneReason}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <FileText size={11} className="text-slate-500" />
                        <span>{piecesPretes}/4 {fr.dossier.piecesPretes}</span>
                      </span>

                      {getStatutBadge(statut)}
                    </div>
                  </div>

                  {/* Ligne 2 : Boutons d'action */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {/* Appeler */}
                    {isTelNorm ? (
                      <a
                        href={`tel:${tel}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition active:scale-95"
                      >
                        <Phone size={13} className="text-slate-600" />
                        <span>{fr.guichetAgent.btnAppeler}</span>
                      </a>
                    ) : (
                      <div className="inline-flex flex-col">
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                          <Phone size={13} className="text-slate-400" />
                          <span>{fr.guichetAgent.btnAppeler}</span>
                        </button>
                        <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                          {fr.guichetAgent.invalidPhoneReason}
                        </span>
                      </div>
                    )}

                    {/* WhatsApp */}
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95"
                      >
                        <MessageSquare size={13} />
                        <span>{fr.guichetAgent.btnWhatsApp}</span>
                      </a>
                    ) : (
                      <div className="inline-flex flex-col">
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                          <MessageSquare size={13} className="text-slate-400" />
                          <span>{fr.guichetAgent.btnWhatsApp}</span>
                        </button>
                        <span className="text-[10px] text-rose-600 font-medium mt-0.5">
                          {fr.guichetAgent.invalidPhoneReason}
                        </span>
                      </div>
                    )}

                    {/* Marquer contacté */}
                    <button
                      type="button"
                      onClick={() => {
                        setContactingId(c.id);
                        setContactNote('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition cursor-pointer active:scale-95"
                    >
                      <Clock size={13} />
                      <span>{fr.guichetAgent.btnMarquerContacte}</span>
                    </button>

                    {/* Dossier venu */}
                    {statut !== 'venu' && statut !== 'saisi' && (
                      <button
                        type="button"
                        onClick={() => handleMarkVenu(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer active:scale-95"
                      >
                        <UserCheck size={13} />
                        <span>{fr.guichetAgent.btnDossierVenu}</span>
                      </button>
                    )}

                    {/* Ouvrir le dossier (disponible pour 'venu' ou 'saisi') */}
                    {(statut === 'venu' || statut === 'saisi') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCandidatId(c.id);
                          setConsentementChecked(Boolean(c.dossier?.consentementGuichet));
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white transition cursor-pointer active:scale-95 shadow-xs"
                      >
                        <Eye size={13} />
                        <span>{fr.guichetAgent.btnOuvrirDossier}</span>
                      </button>
                    )}

                    {/* Bouton Journal */}
                    <button
                      type="button"
                      onClick={() => toggleJournal(c.id)}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer p-1"
                    >
                      <span>{isJournalOpen ? fr.guichetAgent.btnMasquerJournal : fr.guichetAgent.btnVoirJournal}</span>
                      {isJournalOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Journal déroulant par dossier */}
                  {isJournalOpen && (
                    <div className="pt-2 border-t border-slate-100 bg-slate-50/70 -mx-4 -mb-4 p-4 rounded-b-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-slate-500">
                          {fr.guichetAgent.journalTitle}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {journal.length} entrée(s)
                        </span>
                      </div>

                      {journal.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {fr.guichetAgent.journalEmpty}
                        </p>
                      ) : (
                        <div className="space-y-1.5 text-xs">
                          {journal.map((j, idx) => (
                            <div
                              key={idx}
                              className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">{j.action}</span>
                                  <span className="text-[10px] text-slate-400">• par {j.agent}</span>
                                </div>
                                {j.note && (
                                  <p className="text-[11px] text-slate-600 italic">
                                    "{j.note}"
                                  </p>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono shrink-0">
                                {formatDateFr(j.date)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
