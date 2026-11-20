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
} from 'lucide-react';
import { Compte, EvenementJournal, UserRole } from '../types';
import { getComptes, saveComptes } from '../data/mockData';
import { lireJournal, logEvent } from '../utils/journal';
import { fr } from '../i18n/fr';

export type AdminTab = 'admin_comptes' | 'admin_journal';

interface AdminProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

const ITEMS_PER_PAGE = 20;

export const Admin: React.FC<AdminProps> = ({ currentTab, onSelectTab }) => {
  const [comptes, setComptes] = useState<Compte[]>(() => getComptes());
  const [journal, setJournal] = useState<EvenementJournal[]>(() => lireJournal());
  const [hasJournalError, setHasJournalError] = useState(false);

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

  useEffect(() => {
    const handleJournalUpdate = () => refreshJournal();
    window.addEventListener('gcd_journal_updated', handleJournalUpdate);
    window.addEventListener('storage', handleJournalUpdate);
    return () => {
      window.removeEventListener('gcd_journal_updated', handleJournalUpdate);
      window.removeEventListener('storage', handleJournalUpdate);
    };
  }, []);

  // Comptes en attente
  const comptesEnAttente = useMemo(() => {
    return comptes.filter((c) => c.statut === 'en_attente');
  }, [comptes]);

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

        {/* Boutons d'onglets pour grand écran */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => onSelectTab('admin_comptes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'admin_comptes'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Users size={14} />
            <span>{fr.admin.tabs.comptes}</span>
            {comptesEnAttente.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                {comptesEnAttente.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('admin_journal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
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
    </div>
  );
};
