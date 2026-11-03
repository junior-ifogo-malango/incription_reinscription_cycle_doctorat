import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Rapport, RapportStatut } from '../types';
import { INITIAL_RAPPORTS, DEMO_DOCTORANT_NADIA } from '../data/mockData';
import { fr } from '../i18n/fr';

const STORAGE_KEY_RAPPORTS = 'usmba_doctorat_rapports';

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

  // Form states
  const [titre, setTitre] = useState('');
  const [avancement, setAvancement] = useState('');
  const [publications, setPublications] = useState<{ titre: string; doi?: string }[]>([]);
  const [communications, setCommunications] = useState<{ titre: string; lieu?: string }[]>([]);
  const [formationsHeures, setFormationsHeures] = useState<number>(0);
  const [perspectives, setPerspectives] = useState('');
  const [aucuneActivite, setAucuneActivite] = useState(false);

  // New item inputs
  const [newPubTitre, setNewPubTitre] = useState('');
  const [newPubDoi, setNewPubDoi] = useState('');
  const [newCommTitre, setNewCommTitre] = useState('');
  const [newCommLieu, setNewCommLieu] = useState('');

  const loadData = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RAPPORTS);
      let list: Rapport[] = raw ? JSON.parse(raw) : INITIAL_RAPPORTS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_RAPPORTS, JSON.stringify(INITIAL_RAPPORTS));
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
      }

      setRapport(current);
      setTitre(current.titre || DEMO_DOCTORANT_NADIA.sujetTitre);
      setAvancement(current.avancement || '');
      setPublications(current.publications || []);
      setCommunications(current.communications || []);
      setFormationsHeures(current.formationsHeures || 0);
      setPerspectives(current.perspectives || '');
      setAucuneActivite(Boolean(current.aucuneActivite));
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
      setAllRapports(updatedList);
      setRapport(updatedRapport);
      if (toast) {
        setToastMsg(toast);
        setTimeout(() => setToastMsg(null), 3500);
      }
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      return true;
    } catch {
      return false;
    }
  };

  if (!rapport) return null;

  // Verrouillage : modifiable uniquement si 'brouillon' ou 'a_corriger'
  const isEditable = rapport.statut === 'brouillon' || rapport.statut === 'a_corriger';
  const canSubmit = Boolean(titre.trim() && avancement.trim());

  // Ajout de publication
  const handleAddPublication = () => {
    if (!newPubTitre.trim()) return;
    const updated = [
      ...publications,
      { titre: newPubTitre.trim(), doi: newPubDoi.trim() || undefined },
    ];
    setPublications(updated);
    setNewPubTitre('');
    setNewPubDoi('');
  };

  const handleRemovePublication = (idx: number) => {
    setPublications(publications.filter((_, i) => i !== idx));
  };

  // Ajout de communication
  const handleAddCommunication = () => {
    if (!newCommTitre.trim()) return;
    const updated = [
      ...communications,
      { titre: newCommTitre.trim(), lieu: newCommLieu.trim() || undefined },
    ];
    setCommunications(updated);
    setNewCommTitre('');
    setNewCommLieu('');
  };

  const handleRemoveCommunication = (idx: number) => {
    setCommunications(communications.filter((_, i) => i !== idx));
  };

  // Enregistrement brouillon
  const handleSaveDraft = () => {
    const updated: Rapport = {
      ...rapport,
      titre: titre.trim(),
      avancement: avancement.trim(),
      publications,
      communications,
      formationsHeures: Math.max(0, formationsHeures),
      perspectives: perspectives.trim(),
      aucuneActivite,
      statut: rapport.statut === 'a_corriger' ? 'a_corriger' : 'brouillon',
    };
    saveRapportToStorage(updated, fr.reinscription.draftSavedToast);
  };

  // Soumission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const todayStr = new Date().toLocaleDateString('fr-FR');
    const newChrono = [
      ...(rapport.chronologie || []),
      {
        date: todayStr,
        acteur: 'Doctorante (Nadia Alaoui)',
        action:
          rapport.statut === 'a_corriger'
            ? 'Nouvelle soumission après corrections'
            : 'Dépôt et soumission du rapport d’avancement annuel',
      },
    ];

    const updated: Rapport = {
      ...rapport,
      titre: titre.trim(),
      avancement: avancement.trim(),
      publications,
      communications,
      formationsHeures: Math.max(0, formationsHeures),
      perspectives: perspectives.trim(),
      aucuneActivite,
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
    <div className="space-y-4">
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

          <div className="flex items-center gap-1.5 self-start sm:self-center">
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
          {/* INDICATEURS D'ACTIVITÉ CALCULÉS AUTOMATIQUEMENT (Pas de pourcentage) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              {fr.reinscription.indicatorsTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base shrink-0">
                  {publications.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">{fr.reinscription.publicationsCount}</span>
                  <p className="text-[11px] text-slate-500">Revues et articles</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-base shrink-0">
                  {communications.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">{fr.reinscription.communicationsCount}</span>
                  <p className="text-[11px] text-slate-500">Conférences et séminaires</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-base shrink-0">
                  {formationsHeures} h
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">{fr.reinscription.formationsCount}</span>
                  <p className="text-[11px] text-slate-500">Formations transversales</p>
                </div>
              </div>
            </div>
          </div>

          {/* FORMULAIRE STRUCTURÉ DU RAPPORT */}
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            {/* Titre */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {fr.reinscription.titreLabel} *
              </label>
              <input
                type="text"
                disabled={!isEditable}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-slate-50 disabled:text-slate-700"
                required
              />
            </div>

            {/* Avancement */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {fr.reinscription.avancementLabel}
              </label>
              <textarea
                rows={4}
                disabled={!isEditable}
                value={avancement}
                onChange={(e) => setAvancement(e.target.value)}
                placeholder={fr.reinscription.avancementPlaceholder}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-slate-50 disabled:text-slate-700 leading-relaxed"
                required
              />
            </div>

            {/* Case "Aucune activité" */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={!isEditable}
                  checked={aucuneActivite}
                  onChange={(e) => setAucuneActivite(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-xs font-medium text-slate-700">
                  {fr.reinscription.aucuneActiviteLabel}
                </span>
              </label>
            </div>

            {/* Section Publications */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {fr.reinscription.publicationsSectionTitle} ({publications.length})
                </label>
              </div>

              {publications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune publication enregistrée.</p>
              ) : (
                <div className="space-y-1.5">
                  {publications.map((pub, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{pub.titre}</p>
                        {pub.doi && <p className="text-[11px] text-slate-500 font-mono">DOI: {pub.doi}</p>}
                      </div>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleRemovePublication(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isEditable && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={newPubTitre}
                    onChange={(e) => setNewPubTitre(e.target.value)}
                    placeholder={fr.reinscription.pubTitrePlaceholder}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={newPubDoi}
                    onChange={(e) => setNewPubDoi(e.target.value)}
                    placeholder={fr.reinscription.pubDoiPlaceholder}
                    className="w-full sm:w-44 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddPublication}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Ajouter</span>
                  </button>
                </div>
              )}
            </div>

            {/* Section Communications */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {fr.reinscription.communicationsSectionTitle} ({communications.length})
                </label>
              </div>

              {communications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune communication enregistrée.</p>
              ) : (
                <div className="space-y-1.5">
                  {communications.map((comm, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{comm.titre}</p>
                        {comm.lieu && <p className="text-[11px] text-slate-500">Lieu : {comm.lieu}</p>}
                      </div>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCommunication(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isEditable && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    value={newCommTitre}
                    onChange={(e) => setNewCommTitre(e.target.value)}
                    placeholder={fr.reinscription.commTitrePlaceholder}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={newCommLieu}
                    onChange={(e) => setNewCommLieu(e.target.value)}
                    placeholder={fr.reinscription.commLieuPlaceholder}
                    className="w-full sm:w-44 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCommunication}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Ajouter</span>
                  </button>
                </div>
              )}
            </div>

            {/* Heures de formation */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {fr.reinscription.formationsHoursLabel}
              </label>
              <input
                type="number"
                min={0}
                disabled={!isEditable}
                value={formationsHeures}
                onChange={(e) => setFormationsHeures(Number(e.target.value))}
                className="w-32 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-slate-50"
              />
            </div>

            {/* Perspectives */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {fr.reinscription.perspectivesLabel}
              </label>
              <textarea
                rows={3}
                disabled={!isEditable}
                value={perspectives}
                onChange={(e) => setPerspectives(e.target.value)}
                placeholder={fr.reinscription.perspectivesPlaceholder}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-slate-50 disabled:text-slate-700 leading-relaxed"
              />
            </div>

            {/* BOUTONS D'ACTION (Brouillon & Soumettre) */}
            {isEditable && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save size={14} />
                    <span>{fr.reinscription.btnSaveDraft}</span>
                  </button>

                  <div className="flex-1 flex flex-col items-end">
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className={`w-full sm:w-auto px-5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        canSubmit
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs active:scale-98'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Send size={14} />
                      <span>{fr.reinscription.btnSubmit}</span>
                    </button>
                    {!canSubmit && (
                      <span className="text-[10px] text-rose-600 font-medium mt-1">
                        {fr.reinscription.submitDisabledReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
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
  );
};
