import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Heart,
  Trash2,
  Check,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileCheck2,
  Stethoscope,
  Cpu,
  Cog,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { Sujet, Candidat, Enseignant, UserRole } from '../types';
import { fr } from '../i18n/fr';
import { storageService } from '../services/storage';
import { StatusBadge } from './StatusBadge';
import { AdvancedSearchModal, AdvancedFilterCriteria } from './AdvancedSearchModal';
import { normalizeText } from './Autocomplete';

const getDisciplineConfig = (discipline: string) => {
  const norm = discipline
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('medecine') || norm.includes('biotechnologie')) {
    return {
      Icon: Stethoscope,
      barColor: 'bg-emerald-600',
      iconPill: 'bg-emerald-100 text-emerald-800',
      badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      cardBg: 'bg-emerald-50',
      cardBorder: 'border-emerald-200',
    };
  }
  if (norm.includes('informatique') || norm.includes('telecom')) {
    return {
      Icon: Cpu,
      barColor: 'bg-blue-600',
      iconPill: 'bg-blue-100 text-blue-800',
      badge: 'bg-blue-50 text-blue-900 border-blue-200',
      cardBg: 'bg-blue-50',
      cardBorder: 'border-blue-200',
    };
  }
  if (norm.includes('ingenieur') || norm.includes('technique')) {
    return {
      Icon: Cog,
      barColor: 'bg-orange-500',
      iconPill: 'bg-orange-100 text-orange-800',
      badge: 'bg-orange-50 text-orange-900 border-orange-200',
      cardBg: 'bg-orange-50',
      cardBorder: 'border-orange-200',
    };
  }
  if (norm.includes('lettre') || norm.includes('humaine')) {
    return {
      Icon: BookOpen,
      barColor: 'bg-purple-600',
      iconPill: 'bg-purple-100 text-purple-800',
      badge: 'bg-purple-50 text-purple-900 border-purple-200',
      cardBg: 'bg-purple-50',
      cardBorder: 'border-purple-200',
    };
  }
  return {
    Icon: GraduationCap,
    barColor: 'bg-slate-500',
    iconPill: 'bg-slate-100 text-slate-700',
    badge: 'bg-slate-50 text-slate-800 border-slate-200',
    cardBg: 'bg-slate-50',
    cardBorder: 'border-slate-200',
  };
};

interface SujetsModuleProps {
  role: UserRole;
  sujets: Sujet[];
  enseignants: Enseignant[];
  candidat: Candidat;
  onUpdateCandidat: (updated: Candidat) => void;
  initialView?: 'catalog' | 'panier';
  onRequestLogin?: () => void;
  onNavigateTab?: (tab: 'sujets' | 'panier') => void;
}

type InternalView = 'catalog' | 'panier' | 'register' | 'select3' | 'confirmation';

export const SujetsModule: React.FC<SujetsModuleProps> = ({
  role,
  sujets,
  enseignants,
  candidat,
  onUpdateCandidat,
  initialView = 'catalog',
  onRequestLogin,
  onNavigateTab,
}) => {
  const [view, setView] = useState<InternalView>(initialView);

  // Synchronisation si initialView change depuis la barre de navigation
  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Recherche globale, tri et pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'titre' | 'structure'>('titre');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Critères de recherche avancée (ET logique)
  const [advancedCriteria, setAdvancedCriteria] = useState<AdvancedFilterCriteria>({
    encadrant: '',
    discipline: '',
    structure: '',
    keywords: [],
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Dépliage accordéon sur place (sans pop-up)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Alerte 4e sujet refusé
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulaire d'inscription court (5 champs max)
  const [form, setForm] = useState({
    nom: '',
    cne: '',
    cin: '',
    email: '',
    tel: '',
  });
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);

  // Sélection temporaire pour l'étape "Choisis tes 3 sujets"
  const [tempSelection, setTempSelection] = useState<string[]>(
    candidat.candidatures && candidat.candidatures.length > 0
      ? candidat.candidatures
      : candidat.panier.slice(0, 3)
  );

  const getEnseignant = (id: string) => enseignants.find((e) => e.id === id);

  // Listes pour autocomplétion
  const encadrantOptions = useMemo(
    () => Array.from(new Set(enseignants.map((e) => e.nom))),
    [enseignants]
  );
  const disciplineOptions = useMemo(
    () => Array.from(new Set(sujets.map((s) => s.discipline))),
    [sujets]
  );
  const structureOptions = useMemo(
    () => Array.from(new Set(sujets.map((s) => s.structure))),
    [sujets]
  );
  const keywordOptions = useMemo(
    () => Array.from(new Set(sujets.flatMap((s) => s.motsCles))),
    [sujets]
  );

  // Nombre de critères actifs
  const activeCriteriaCount = useMemo(() => {
    let count = 0;
    if (advancedCriteria.encadrant.trim()) count++;
    if (advancedCriteria.discipline.trim()) count++;
    if (advancedCriteria.structure.trim()) count++;
    count += advancedCriteria.keywords.length;
    return count;
  }, [advancedCriteria]);

  // Filtrage combiné (ET logique) et Tri
  const filteredSujets = useMemo(() => {
    const normSearch = normalizeText(searchQuery);
    const normEncadrant = normalizeText(advancedCriteria.encadrant);
    const normDiscipline = normalizeText(advancedCriteria.discipline);
    const normStructure = normalizeText(advancedCriteria.structure);

    return sujets
      .filter((s) => {
        const ens = getEnseignant(s.enseignantId);
        const ensNomNorm = ens ? normalizeText(ens.nom) : '';
        const sTitreNorm = normalizeText(s.titre);
        const sDiscNorm = normalizeText(s.discipline);
        const sStructNorm = normalizeText(s.structure);
        const sKeywordsNorm = s.motsCles.map((k) => normalizeText(k));

        // 1. Recherche globale directe (titre, mots-clés, encadrant)
        if (normSearch) {
          const matchGlobal =
            sTitreNorm.includes(normSearch) ||
            ensNomNorm.includes(normSearch) ||
            sKeywordsNorm.some((k) => k.includes(normSearch)) ||
            sDiscNorm.includes(normSearch) ||
            sStructNorm.includes(normSearch);
          if (!matchGlobal) return false;
        }

        // 2. Filtres avancés combinés (ET logique)
        if (normEncadrant && !ensNomNorm.includes(normEncadrant)) {
          return false;
        }
        if (normDiscipline && !sDiscNorm.includes(normDiscipline)) {
          return false;
        }
        if (normStructure && !sStructNorm.includes(normStructure)) {
          return false;
        }
        if (advancedCriteria.keywords.length > 0) {
          const allKeywordsMatch = advancedCriteria.keywords.every((kw) => {
            const normKw = normalizeText(kw);
            return sKeywordsNorm.some((k) => k.includes(normKw));
          });
          if (!allKeywordsMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'structure') {
          return a.structure.localeCompare(b.structure);
        }
        return a.titre.localeCompare(b.titre);
      });
  }, [sujets, searchQuery, advancedCriteria, sortBy, enseignants]);

  // Pagination (6 par page)
  const totalPages = Math.ceil(filteredSujets.length / itemsPerPage) || 1;
  const paginatedSujets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSujets.slice(start, start + itemsPerPage);
  }, [filteredSujets, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setAdvancedCriteria({
      encadrant: '',
      discipline: '',
      structure: '',
      keywords: [],
    });
    setSortBy('titre');
    setCurrentPage(1);
  };

  // Toggle du panier d'intérêt (illimité)
  const toggleCart = (sujetId: string) => {
    const inCart = candidat.panier.includes(sujetId);
    const newPanier = inCart
      ? candidat.panier.filter((id) => id !== sujetId)
      : [...candidat.panier, sujetId];

    const updated: Candidat = {
      ...candidat,
      panier: newPanier,
      panierInteret: newPanier,
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);
  };

  // Connexion démo
  const handleLoginDemo = () => {
    const demo = storageService.loginAsDemo();
    onUpdateCandidat(demo);
    setTempSelection(demo.candidatures);
  };

  // Déconnexion (retour visiteur)
  const handleLogout = () => {
    const visitor: Candidat = {
      id: 'visiteur-001',
      nom: '',
      cne: '',
      cin: '',
      email: '',
      tel: '',
      panier: candidat.panier, // conserve le panier local
      candidatures: [],
      compteCree: false,
    };
    onUpdateCandidat(visitor);
    storageService.setCandidat(visitor);
  };

  // Clic sur "Candidater"
  const handleStartCandidater = () => {
    setErrorMsg(null);
    if (!candidat.compteCree) {
      setView('register');
    } else {
      setTempSelection(
        candidat.candidatures.length > 0
          ? candidat.candidatures
          : candidat.panier.slice(0, Math.min(3, candidat.panier.length))
      );
      setView('select3');
    }
  };

  // Validation format CNE & CIN
  const validateCne = (cne: string) => /^[A-Z][0-9]{9}$/i.test(cne.trim());
  const validateCin = (cin: string) => /^[A-Z]{1,2}[0-9]{5,6}$/i.test(cin.trim());

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom || !form.cne || !form.cin || !form.email || !form.tel) {
      setFormValidationMsg(fr.sujetsModule.validationRequired);
      return;
    }
    if (!validateCne(form.cne)) {
      setFormValidationMsg(fr.sujetsModule.validationCneError);
      return;
    }
    if (!validateCin(form.cin)) {
      setFormValidationMsg(fr.sujetsModule.validationCinError);
      return;
    }

    setFormValidationMsg(null);
    const updated: Candidat = {
      ...candidat,
      id: `cand-${Date.now()}`,
      nom: form.nom.trim(),
      cne: form.cne.trim().toUpperCase(),
      cin: form.cin.trim().toUpperCase(),
      email: form.email.trim(),
      tel: form.tel.trim(),
      compteCree: true,
      panier: candidat.panier,
      candidatures: [],
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);
    setTempSelection(candidat.panier.slice(0, Math.min(3, candidat.panier.length)));
    setView('select3');
  };

  // Sélection dans "Choisis tes 3 sujets"
  const toggleSelectForCandidate = (id: string) => {
    setErrorMsg(null);
    if (tempSelection.includes(id)) {
      setTempSelection(tempSelection.filter((x) => x !== id));
    } else {
      if (tempSelection.length >= 3) {
        // 4e sujet refusé
        setErrorMsg(fr.sujetsModule.fourthRefusedAlert);
        return;
      }
      setTempSelection([...tempSelection, id]);
    }
  };

  // Retirer automatiquement du panier les sujets déjà candidatés
  React.useEffect(() => {
    if (candidat.candidatures && candidat.candidatures.length > 0) {
      const hasOverlap = candidat.panier.some((id) => candidat.candidatures.includes(id));
      if (hasOverlap) {
        const cleanedPanier = candidat.panier.filter((id) => !candidat.candidatures.includes(id));
        const updated: Candidat = {
          ...candidat,
          panier: cleanedPanier,
          panierInteret: cleanedPanier,
        };
        onUpdateCandidat(updated);
        storageService.setCandidat(updated);
      }
    }
  }, [candidat.candidatures, candidat.panier, onUpdateCandidat]);

  // Validation finale des candidatures
  const handleValidateCandidatures = () => {
    // Retirer les sujets candidatés du panier
    const remainingPanier = candidat.panier.filter((id) => !tempSelection.includes(id));
    const updated: Candidat = {
      ...candidat,
      panier: remainingPanier,
      panierInteret: remainingPanier,
      candidatures: tempSelection,
      interets: tempSelection,
    };
    onUpdateCandidat(updated);
    storageService.setCandidat(updated);
    setView('confirmation');
  };

  // Sujets du panier
  const cartItems = sujets.filter((s) => candidat.panier.includes(s.id));
  const candidateItems = sujets.filter((s) => candidat.candidatures.includes(s.id));

  // Règle du bouton Valider : actif seulement à 3 exactement, ou moins si panier < 3
  const isValidateActive =
    cartItems.length >= 3 ? tempSelection.length === 3 : tempSelection.length === cartItems.length;

  /* ========================================================================= */
  /* VUE 4 : CONFIRMATION DES CANDIDATURES DÉPOSÉES                            */
  /* ========================================================================= */
  if (view === 'confirmation') {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1.5">
          <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">{fr.sujetsModule.confirmationTitle}</h2>
          <p className="text-xs text-slate-600">{fr.sujetsModule.confirmationSub}</p>
        </div>

        <div className="space-y-2">
          {candidateItems.map((sujet) => (
            <div key={sujet.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {sujet.discipline}
                </span>
                <StatusBadge type="candidature" size="sm" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">{sujet.titre}</h4>
              <p className="text-[11px] text-slate-500">{sujet.structure}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setView('catalog');
            onNavigateTab?.('sujets');
          }}
          className="w-full min-h-[46px] py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
        >
          {fr.sujetsModule.btnBackToCatalog}
        </button>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 3 : ÉCRAN "CHOISIS TES 3 SUJETS"                                       */
  /* ========================================================================= */
  if (view === 'select3') {
    return (
      <div className="space-y-3.5">
        <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase text-amber-300">{fr.sujetsModule.choose3Title}</h2>
            <p className="text-[11px] text-slate-300">{fr.sujetsModule.choose3Sub}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950">
            {fr.sujetsModule.counterFormat.replace('{count}', String(tempSelection.length))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          {cartItems.map((sujet) => {
            const isChecked = tempSelection.includes(sujet.id);
            const { Icon: DisciplineIcon, iconPill, badge: badgeColor } = getDisciplineConfig(sujet.discipline);

            return (
              <div
                key={sujet.id}
                onClick={() => toggleSelectForCandidate(sujet.id)}
                className={`p-3 rounded-xl border cursor-pointer select-none transition ${
                  isChecked
                    ? 'bg-emerald-50/70 border-emerald-400 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                      isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check size={13} />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${iconPill}`} aria-hidden="true">
                        <DisciplineIcon size={11} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                        {sujet.discipline}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{sujet.titre}</h4>
                    <p className="text-[11px] text-slate-600">{sujet.structure}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 space-y-2">
          {!isValidateActive && (
            <p className="text-[11px] text-amber-800 text-center font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
              {fr.sujetsModule.exact3Notice}
            </p>
          )}

          <button
            type="button"
            disabled={!isValidateActive}
            onClick={handleValidateCandidatures}
            className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
              isValidateActive
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check size={16} />
            <span>{fr.sujetsModule.btnValiderCandidatures}</span>
          </button>

          <button
            type="button"
            onClick={() => setView('panier')}
            className="w-full py-2 text-xs text-slate-600 hover:underline text-center"
          >
            {fr.common.back}
          </button>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 2 : FORMULAIRE DE CRÉATION DE COMPTE (5 CHAMPS MAX)                   */
  /* ========================================================================= */
  if (view === 'register') {
    return (
      <div className="space-y-3.5">
        <div className="bg-slate-900 text-white rounded-xl p-3.5">
          <h2 className="text-xs font-bold uppercase text-amber-300">{fr.sujetsModule.accountFormTitle}</h2>
          <p className="text-[11px] text-slate-300 mt-0.5">{fr.sujetsModule.accountFormSub}</p>
        </div>

        {formValidationMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
            {formValidationMsg}
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.nameLabel} *</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.cneLabel} *</label>
              <input
                type="text"
                placeholder="N138249871"
                value={form.cne}
                onChange={(e) => setForm({ ...form, cne: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.cinLabel} *</label>
              <input
                type="text"
                placeholder="CD789123"
                value={form.cin}
                onChange={(e) => setForm({ ...form, cin: e.target.value })}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.emailLabel} *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">{fr.sujetsModule.telLabel} *</label>
            <input
              type="tel"
              value={form.tel}
              onChange={(e) => setForm({ ...form, tel: e.target.value })}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full min-h-[46px] py-2.5 rounded-xl font-bold text-xs bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-xs"
            >
              {fr.sujetsModule.btnSubmitAccount}
            </button>
            <button
              type="button"
              onClick={() => setView('panier')}
              className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 text-center"
            >
              {fr.common.cancel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE PANIER (ILLIMITÉ)                                                     */
  /* ========================================================================= */
  if (view === 'panier') {
    return (
      <div className="space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{fr.sujetsModule.panierTitle}</h2>
            <span className="text-[11px] text-slate-500">
              {fr.sujetsModule.panierCount.replace('{count}', String(cartItems.length))}
            </span>
          </div>

          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={handleStartCandidater}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition flex items-center gap-1.5 shadow-xs"
            >
              <span>{fr.sujetsModule.btnCandidater}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <Heart size={28} className="text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600">{fr.sujetsModule.panierEmpty}</p>
            <button
              type="button"
              onClick={() => {
                setView('catalog');
                onNavigateTab?.('sujets');
              }}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {fr.sujetsModule.btnBackToCatalog}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cartItems.map((sujet) => {
              const ens = getEnseignant(sujet.enseignantId);
              const isApplied = candidat.candidatures.includes(sujet.id);

              const { Icon: DisciplineIcon, barColor, iconPill, badge: badgeColor, cardBg, cardBorder } = getDisciplineConfig(sujet.discipline);

              return (
                <div
                  key={sujet.id}
                  className={`group ${cardBg} border ${cardBorder} rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between overflow-hidden`}
                >
                  <div className={`h-1 w-full ${barColor}`} />
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconPill}`}
                          aria-hidden="true"
                        >
                          <DisciplineIcon size={13} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {sujet.discipline}
                        </span>
                      </div>
                      {isApplied && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FileCheck2 size={12} className="text-emerald-600 shrink-0" />
                          <span>{fr.sujetsModule.alreadyAppliedBadge}</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{sujet.titre}</h4>
                    <p className="text-[11px] text-slate-600">
                      <span className="font-medium text-slate-700">{sujet.structure}</span> {ens ? `• ${ens.nom}` : ''}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => toggleCart(sujet.id)}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>{fr.sujetsModule.btnRemove}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartCandidater}
                className="w-full min-h-[48px] py-3 rounded-xl font-bold text-xs bg-emerald-700 hover:bg-emerald-800 text-white transition flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{fr.sujetsModule.btnCandidater}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ========================================================================= */
  /* VUE 1 : CATALOGUE DES SUJETS (ACCUEIL CANDIDAT)                           */
  /* ========================================================================= */
  return (
    <div className="space-y-3">
      {/* Barre de recherche globale instantanée avec icône filtre à droite */}
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder={fr.sujetsModule.searchPlaceholder}
          className="w-full pl-9 pr-20 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-xs"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="p-1 text-slate-400 hover:text-slate-600"
              aria-label="Effacer recherche"
            >
              <X size={14} />
            </button>
          )}

          {/* Simple icône filtre sans texte avec badge du nombre de critères */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-label={fr.sujetsModule.btnFilterModal}
            className={`relative p-1.5 rounded-lg border transition ${
              activeCriteriaCount > 0
                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal size={15} />
            {activeCriteriaCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shadow-xs">
                {activeCriteriaCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Puces de critères actifs retirables (✕) sous la barre */}
      {activeCriteriaCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {advancedCriteria.encadrant && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.encadrant}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, encadrant: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.discipline && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.discipline}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, discipline: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.structure && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span>{advancedCriteria.structure}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({ ...advancedCriteria, structure: '' })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          )}

          {advancedCriteria.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full"
            >
              <span>#{kw}</span>
              <button
                type="button"
                onClick={() =>
                  setAdvancedCriteria({
                    ...advancedCriteria,
                    keywords: advancedCriteria.keywords.filter((k) => k !== kw),
                  })
                }
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1 font-medium"
          >
            {fr.sujetsModule.btnReset}
          </button>
        </div>
      )}

      {/* Ligne compteur et tri */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5">
        <span className="font-semibold text-slate-700">
          {fr.sujetsModule.countSujets.replace('{count}', String(filteredSujets.length))}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">{fr.sujetsModule.sortLabel}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'titre' | 'structure')}
            className="bg-white border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
          >
            <option value="titre">{fr.sujetsModule.sortTitleAZ}</option>
            <option value="structure">{fr.sujetsModule.sortStructure}</option>
          </select>

          {(searchQuery || activeCriteriaCount > 0) && (
            <button
              onClick={handleResetFilters}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5 ml-1"
            >
              <RotateCcw size={11} />
              <span>{fr.sujetsModule.btnReset}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Popup de Recherche Avancée */}
      <AdvancedSearchModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        criteria={advancedCriteria}
        onApply={(crit) => {
          setAdvancedCriteria(crit);
          setCurrentPage(1);
        }}
        onReset={handleResetFilters}
        encadrantOptions={encadrantOptions}
        disciplineOptions={disciplineOptions}
        structureOptions={structureOptions}
        keywordOptions={keywordOptions}
      />

      {/* GRILLE RESPONSIVE : 1 COLONNE MOBILE, 2-3 COLONNES SUR GRAND ÉCRAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {paginatedSujets.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-xs text-slate-600">{fr.sujetsModule.emptyCatalog}</p>
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              {fr.sujetsModule.btnReset}
            </button>
          </div>
        ) : (
          paginatedSujets.map((sujet) => {
            const isExpanded = expandedId === sujet.id;
            const inCart = candidat.panier.includes(sujet.id);
            const isApplied = candidat.candidatures.includes(sujet.id);
            const ens = getEnseignant(sujet.enseignantId);
            const { Icon: DisciplineIcon, barColor, iconPill, badge: badgeColor, cardBg, cardBorder } = getDisciplineConfig(sujet.discipline);

            return (
              <div
                key={sujet.id}
                className={`group ${cardBg} border ${cardBorder} rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between overflow-hidden`}
              >
                {/* Bande colorée de 4 px en haut (couleur de la discipline) */}
                <div className={`h-1 w-full ${barColor}`} />

                {/* Corps de la carte compacte avec espacements réguliers */}
                <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sujet.id)}
                    className="cursor-pointer space-y-2"
                  >
                    {/* Badge de discipline avec pastille icône arrondie */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconPill}`}
                        aria-hidden="true"
                      >
                        <DisciplineIcon size={13} />
                      </div>
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border leading-tight line-clamp-1 ${badgeColor}`}>
                        {sujet.discipline}
                      </span>
                    </div>

                    {/* Titre en police plus grande que l'encadrant et la structure */}
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
                      {sujet.titre}
                    </h3>

                    {/* Encadrant et structure */}
                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      <p className="truncate font-medium text-slate-700">{sujet.structure}</p>
                      {ens && <p className="truncate text-slate-500">{ens.nom}</p>}
                    </div>

                    {/* DÉTAIL DÉPLIABLE SUR PLACE (SANS POP-UP) */}
                    {isExpanded && (
                      <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                        {sujet.descriptionCourte && (
                          <p className="italic bg-slate-50 p-2 rounded-lg text-[11px] leading-relaxed text-slate-700">
                            {sujet.descriptionCourte}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {sujet.motsCles.map((k) => (
                            <span key={k} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                              #{k}
                            </span>
                          ))}
                        </div>
                        {ens && (
                          <div className="text-[11px] text-slate-600 pt-0.5">
                            <span className="font-semibold text-slate-800">{ens.nom}</span> • {ens.email}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bouton ♡ Ajouter au panier / Dans le panier / Candidature déposée */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span
                      onClick={() => setExpandedId(isExpanded ? null : sujet.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>

                    {isApplied ? (
                      <button
                        type="button"
                        disabled
                        className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center gap-1.5 cursor-not-allowed opacity-90 select-none"
                      >
                        <FileCheck2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{fr.sujetsModule.candidatureDeposeeBadge}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCart(sujet.id);
                        }}
                        className={`text-xs font-bold py-1 px-2.5 rounded-lg border transition flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                          inCart
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <Heart size={13} className={inCart ? 'fill-rose-600 text-rose-600' : 'text-slate-400'} />
                        <span>{inCart ? fr.sujetsModule.btnInCart : fr.sujetsModule.btnAddToCart}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION (6 PAR PAGE) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 text-xs">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              currentPage === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ChevronLeft size={14} />
            <span>{fr.sujetsModule.btnPrevPage}</span>
          </button>

          <span className="text-slate-500 font-mono text-[11px]">
            {fr.sujetsModule.pageIndicator
              .replace('{page}', String(currentPage))
              .replace('{total}', String(totalPages))}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
              currentPage === totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span>{fr.sujetsModule.btnNextPage}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
