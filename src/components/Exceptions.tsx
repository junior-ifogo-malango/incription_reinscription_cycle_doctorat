import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  Send,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { Creneau, Enseignant, Candidat, Rapport, PV } from '../types';
import { storageService } from '../services/storage';
import { INITIAL_RAPPORTS, MOCK_CANDIDATS } from '../data/mockData';
import { fr } from '../i18n/fr';

// Constante unique du seuil d'inactivité (48 heures)
export const SEUIL_HEURES = 48;

export const Exceptions: React.FC = () => {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    try {
      setCreneaux(storageService.getCreneaux());
      setEnseignants(storageService.getEnseignants());
      setCandidat(storageService.getCandidat());

      const rawRapports = localStorage.getItem('usmba_doctorat_rapports');
      if (rawRapports) {
        setRapports(JSON.parse(rawRapports));
      } else {
        localStorage.setItem('usmba_doctorat_rapports', JSON.stringify(INITIAL_RAPPORTS));
        setRapports(INITIAL_RAPPORTS);
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('usmba_rapports_updated', handleSync);
    return () => {
      window.removeEventListener('usmba_rapports_updated', handleSync);
    };
  }, []);

  // Règle : Exceptions ignore les versions remplacées
  const getPvsValides = (): PV[] => {
    try {
      const raw = localStorage.getItem('usmba_doctorat_pvs');
      if (!raw) return [];
      const parsed: PV[] = JSON.parse(raw);
      return parsed.filter((p) => !p.remplaceePar);
    } catch {
      return [];
    }
  };

  const getEnseignantName = (id: string): string => {
    const ens = enseignants.find((e) => e.id === id);
    return ens ? ens.nom : id;
  };

  const getCandidatInfo = (id?: string): { nom: string; cne: string } => {
    if (!id) return { nom: 'Candidat inconnu', cne: '-' };
    if (id === 'cand-salma') return { nom: 'Salma Alami', cne: 'N149021873' };
    if (id === 'cand-khadija') return { nom: 'Khadija Tazi', cne: 'M142078911' };
    if (candidat && (id === candidat.id || id === 'cand-001')) {
      return {
        nom: candidat.nom || 'Yassine El Fassi',
        cne: candidat.cne || 'N138249871',
      };
    }
    return { nom: id, cne: '-' };
  };

  // 1. Filtrer les créneaux non confirmés (> 48h)
  const now = Date.now();
  const nonConfirmes = creneaux.filter((c) => {
    if (c.statut === 'reserve' && c.dateReservation) {
      const resTime = new Date(c.dateReservation).getTime();
      const diffHours = (now - resTime) / (1000 * 60 * 60);
      return diffHours > SEUIL_HEURES;
    }
    return false;
  });

  // 1.b Filtrer les rapports de réinscription en retard (> 48h sans action)
  const rapportsEnRetard = rapports.filter((r) => {
    if (r.statut !== 'soumis' && r.statut !== 'avis_comite') return false;
    if (!r.soumisLe) return false;
    const resTime = new Date(r.soumisLe).getTime();
    const diffHours = (now - resTime) / (1000 * 60 * 60);
    return diffHours > SEUIL_HEURES;
  });

  const handleRelancerRapport = (reportId: string) => {
    const todayStr = new Date().toLocaleDateString('fr-FR');
    const updated = rapports.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          relanceLe: new Date().toISOString(),
          chronologie: [
            ...(r.chronologie || []),
            {
              date: todayStr,
              acteur: 'Direction CED',
              action: 'Relance administrative simulée transmise',
            },
          ],
        };
      }
      return r;
    });
    setRapports(updated);
    try {
      localStorage.setItem('usmba_doctorat_rapports', JSON.stringify(updated));
      setToastMessage(fr.reinscription.relanceReportToast);
      window.dispatchEvent(new CustomEvent('usmba_rapports_updated'));
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Erreur de stockage');
    }
  };

  // Calcul du temps écoulé
  const getDureeEcoulee = (dateReservation?: string): string => {
    if (!dateReservation) return '';
    const resTime = new Date(dateReservation).getTime();
    const diffHours = Math.max(0, Math.floor((now - resTime) / (1000 * 60 * 60)));
    return `${diffHours} h`;
  };

  // Formatage de la date de relance
  const formatRelanceDate = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} à ${d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  // Bouton « Relancer (simulation) » : enregistre relanceLe = maintenant
  const handleRelancer = (creneauId: string) => {
    const updated = creneaux.map((c) => {
      if (c.id === creneauId) {
        return {
          ...c,
          relanceLe: new Date().toISOString(),
        };
      }
      return c;
    });

    try {
      storageService.setCreneaux(updated);
      setCreneaux(updated);
      setToastMessage('Relance simulée enregistrée avec succès.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage(fr.exceptions.storageError);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // 2. Détection des conflits
  interface ConflitItem {
    id: string;
    type: 'enseignant' | 'candidat';
    description: string;
    creneauIds: string[];
  }

  const conflits: ConflitItem[] = [];

  // a) Deux créneaux d'un même enseignant à la même date et heure
  const teacherSlotsMap: Record<string, Creneau[]> = {};
  creneaux.forEach((c) => {
    const key = `${c.enseignantId}-${c.date}-${c.heure}`;
    if (!teacherSlotsMap[key]) {
      teacherSlotsMap[key] = [];
    }
    teacherSlotsMap[key].push(c);
  });

  Object.entries(teacherSlotsMap).forEach(([key, list]) => {
    if (list.length > 1) {
      const ens = getEnseignantName(list[0].enseignantId);
      conflits.push({
        id: `conf-ens-${key}`,
        type: 'enseignant',
        description: `${fr.exceptions.conflictTeacher
          .replace('{date}', list[0].date)
          .replace('{heure}', list[0].heure)} (${ens})`,
        creneauIds: list.map((c) => c.id),
      });
    }
  });

  // b) Un candidat sur plusieurs créneaux actifs ('reserve' ou 'confirme')
  const candidateSlotsMap: Record<string, Creneau[]> = {};
  creneaux.forEach((c) => {
    if ((c.statut === 'reserve' || c.statut === 'confirme') && c.candidatId) {
      if (!candidateSlotsMap[c.candidatId]) {
        candidateSlotsMap[c.candidatId] = [];
      }
      candidateSlotsMap[c.candidatId].push(c);
    }
  });

  Object.entries(candidateSlotsMap).forEach(([cId, list]) => {
    if (list.length > 1) {
      const candInfo = getCandidatInfo(cId);
      conflits.push({
        id: `conf-cand-${cId}`,
        type: 'candidat',
        description: `${fr.exceptions.conflictCandidate} : ${candInfo.nom} (${list.length} créneaux)`,
        creneauIds: list.map((c) => c.id),
      });
    }
  });

  // 3. Dossiers à traiter au guichet
  interface GuichetDossier {
    id: string;
    nom: string;
    cne: string;
    piecesPretes: number;
    motif?: string;
    statut: string;
    statutRaw?: string;
    agent: string;
    derniereAction: string;
  }

  const tousCandidats: Candidat[] = [...MOCK_CANDIDATS];
  try {
    const rawCur = localStorage.getItem('usmba_doctorat_candidat');
    if (rawCur) {
      const cur: Candidat = JSON.parse(rawCur);
      const idx = tousCandidats.findIndex((c) => c.id === cur.id);
      if (idx !== -1) tousCandidats[idx] = cur;
      else tousCandidats.push(cur);
    }
    const rawOverrides = localStorage.getItem('usmba_candidats_overrides');
    if (rawOverrides) {
      const overrides: Record<string, Candidat> = JSON.parse(rawOverrides);
      Object.values(overrides).forEach((cand) => {
        const idx = tousCandidats.findIndex((c) => c.id === cand.id);
        if (idx !== -1) tousCandidats[idx] = cand;
        else tousCandidats.push(cand);
      });
    }
    const rawAccounts = localStorage.getItem('usmba_registered_accounts');
    if (rawAccounts) {
      const accounts: Candidat[] = JSON.parse(rawAccounts);
      accounts.forEach((cand) => {
        const idx = tousCandidats.findIndex((c) => c.id === cand.id);
        if (idx !== -1) tousCandidats[idx] = cand;
        else tousCandidats.push(cand);
      });
    }
  } catch {}

  const guichetDossiers: GuichetDossier[] = [];
  tousCandidats.forEach((c) => {
    if (c.dossier?.guichet || (c.dossier as any)?.traiterAuGuichet) {
      const piecesCount = (c.pieces || []).filter((p) => p.statut === 'prouvee').length;
      let motifLabel: string | undefined = undefined;

      if (c.dossier?.casParticulier && c.dossier?.motif) {
        const m = c.dossier.motif;
        if (m === 'AUTRE') {
          motifLabel = c.dossier.motifAutre || 'Autre motif';
        } else if (m in fr.dossier.casParticulierMotifs) {
          motifLabel = fr.dossier.casParticulierMotifs[m as keyof typeof fr.dossier.casParticulierMotifs];
        } else {
          motifLabel = m;
        }
      }

      const statutRaw = c.dossier?.guichetStatut || 'a_contacter';
      const statutLabel =
        statutRaw === 'saisi'
          ? fr.guichetAgent.statuts.saisi
          : statutRaw === 'venu'
          ? fr.guichetAgent.statuts.venu
          : statutRaw === 'contacte'
          ? fr.guichetAgent.statuts.contacte
          : fr.guichetAgent.statuts.a_contacter;

      const journal = c.dossier?.journalGuichet || [];
      const derniereEntree = journal.length > 0 ? journal[journal.length - 1] : undefined;
      const agentNom = c.dossier?.saisiPar || derniereEntree?.agent || '-';
      const derniereAction = derniereEntree?.action || 'Demande initiale';

      guichetDossiers.push({
        id: c.id,
        nom: c.nom || 'Candidat inconnu',
        cne: c.cne || '-',
        piecesPretes: piecesCount,
        motif: motifLabel,
        statut: statutLabel,
        statutRaw,
        agent: agentNom,
        derniereAction,
      });
    }
  });

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 max-w-[1100px] mx-auto pb-12">
      {/* Toast de notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* En-tête sobre */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {fr.exceptions.title}
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Lecture seule
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {fr.exceptions.subtitle}
          </p>
        </div>
      </div>

      {/* En haut : 3 compteurs cliquables (ancres vers les sections) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => scrollToSection('section-non-confirmes')}
          className="bg-white border border-slate-200 hover:border-rose-300 rounded-2xl p-4 shadow-xs text-left transition cursor-pointer hover:bg-rose-50/30 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-rose-900">
              {fr.exceptions.navNonConfirmes}
            </span>
            <span
              className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                nonConfirmes.length > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {nonConfirmes.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock size={12} />
            <span>Seuil &gt; {SEUIL_HEURES} h</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => scrollToSection('section-conflits')}
          className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-xs text-left transition cursor-pointer hover:bg-amber-50/30 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-amber-900">
              {fr.exceptions.navConflits}
            </span>
            <span
              className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                conflits.length > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {conflits.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <AlertTriangle size={12} />
            <span>Enseignants &amp; Candidats</span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => scrollToSection('section-guichet')}
          className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-4 shadow-xs text-left transition cursor-pointer hover:bg-purple-50/30 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 group-hover:text-purple-900">
              {fr.exceptions.navGuichet}
            </span>
            <span
              className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                guichetDossiers.length > 0
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {guichetDossiers.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <UserCheck size={12} />
            <span>Saisie assistée</span>
          </p>
        </button>
      </div>

      {/* 1. SECTION : « Entretiens non confirmés » */}
      <section id="section-non-confirmes" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {fr.exceptions.sectionNonConfirmesTitle}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {nonConfirmes.length} cas
          </span>
        </div>

        {nonConfirmes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
            {fr.exceptions.emptyNonConfirmes}
          </div>
        ) : (
          <>
            {/* Version Bureau (Tableau compact ≥ 768px) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">{fr.exceptions.colCandidat}</th>
                    <th className="px-4 py-3">{fr.exceptions.colEnseignant}</th>
                    <th className="px-4 py-3">{fr.exceptions.colDateHeure}</th>
                    <th className="px-4 py-3">{fr.exceptions.colDuree}</th>
                    <th className="px-4 py-3">{fr.exceptions.colStatut}</th>
                    <th className="px-4 py-3 text-right">{fr.exceptions.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nonConfirmes.map((c) => {
                    const candInfo = getCandidatInfo(c.candidatId);
                    const ensNom = getEnseignantName(c.enseignantId);
                    const duree = getDureeEcoulee(c.dateReservation);
                    const isRelance = Boolean(c.relanceLe);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {candInfo.nom}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {ensNom}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-slate-800">{c.date}</span>
                          <span className="text-slate-400 ml-1.5">{c.heure}</span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-rose-700">
                          {duree}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs px-2.5 py-1">
                            <Clock size={13} className="text-rose-600 shrink-0" />
                            <span>{fr.exceptions.silenceBadge}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {isRelance ? (
                            <span className="text-[11px] font-medium text-slate-500 italic">
                              {fr.exceptions.relanceLePrefix} {formatRelanceDate(c.relanceLe)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRelancer(c.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition cursor-pointer active:scale-98 shadow-xs"
                            >
                              <Send size={12} />
                              <span>{fr.exceptions.btnRelancer}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Version Mobile (Cartes 1 colonne) */}
            <div className="md:hidden space-y-2.5">
              {nonConfirmes.map((c) => {
                const candInfo = getCandidatInfo(c.candidatId);
                const ensNom = getEnseignantName(c.enseignantId);
                const duree = getDureeEcoulee(c.dateReservation);
                const isRelance = Boolean(c.relanceLe);

                return (
                  <div
                    key={c.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs text-slate-900">{candInfo.nom}</h3>
                        <p className="text-[11px] text-slate-500">{ensNom}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        <Clock size={11} />
                        <span>{duree}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        <span className="font-medium">{c.date}</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-700">{c.heure}</span>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-medium rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] px-2 py-0.5">
                        <Clock size={11} className="text-rose-600" />
                        <span>{fr.exceptions.silenceBadge}</span>
                      </span>

                      {isRelance ? (
                        <span className="text-[10px] text-slate-500 italic">
                          {fr.exceptions.relanceLePrefix} {formatRelanceDate(c.relanceLe)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRelancer(c.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 text-white cursor-pointer active:scale-98"
                        >
                          <Send size={11} />
                          <span>{fr.exceptions.btnRelancer}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 2. SECTION : « Conflits détectés » */}
      <section id="section-conflits" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {fr.exceptions.sectionConflitsTitle}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {conflits.length} détecté(s)
          </span>
        </div>

        {conflits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
            {fr.exceptions.emptyConflits}
          </div>
        ) : (
          <div className="space-y-2">
            {conflits.map((cf) => (
              <div
                key={cf.id}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center gap-3 shadow-xs"
              >
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <span className="font-medium">{cf.description}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. SECTION : « Dossiers à traiter au guichet » */}
      <section id="section-guichet" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <h2 className="text-sm font-bold text-slate-900">
              {fr.exceptions.sectionGuichetTitle}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {guichetDossiers.length} dossier(s)
          </span>
        </div>

        {guichetDossiers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
            {fr.exceptions.emptyGuichet}
          </div>
        ) : (
          <>
            {/* Version Bureau (Tableau compact ≥ 768px) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">{fr.exceptions.colCandidat}</th>
                    <th className="px-4 py-3">{fr.exceptions.colCne}</th>
                    <th className="px-4 py-3">{fr.exceptions.colPieces}</th>
                    <th className="px-4 py-3">{fr.exceptions.colMotif}</th>
                    <th className="px-4 py-3">{fr.guichetAgent.colStatut}</th>
                    <th className="px-4 py-3">{fr.guichetAgent.colJournalAgent}</th>
                    <th className="px-4 py-3">{fr.guichetAgent.colJournalAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {guichetDossiers.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {g.nom}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono">
                        {g.cne}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          <FileText size={11} className="text-slate-500" />
                          <span>{g.piecesPretes}/4 {fr.dossier.piecesPretes}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {g.motif ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                            {g.motif}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {fr.exceptions.standardDossier}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            g.statutRaw === 'saisi'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : g.statutRaw === 'venu'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : g.statutRaw === 'contacte'
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {g.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {g.agent}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {g.derniereAction}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Version Mobile (Cartes 1 colonne) */}
            <div className="md:hidden space-y-2.5">
              {guichetDossiers.map((g) => (
                <div
                  key={g.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{g.nom}</span>
                    <span className="font-mono text-[11px] text-slate-500">{g.cne}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      <FileText size={11} className="text-slate-500" />
                      <span>{g.piecesPretes}/4 {fr.dossier.piecesPretes}</span>
                    </span>

                    {g.motif && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                        {g.motif}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        g.statutRaw === 'saisi'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : g.statutRaw === 'venu'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : g.statutRaw === 'contacte'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {g.statut}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                    <span>
                      Agent : <strong className="text-slate-800">{g.agent}</strong>
                    </span>
                    <span className="text-slate-500 italic">
                      {g.derniereAction}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* SECTION 4 : RAPPORTS DE RÉINSCRIPTION EN RETARD (> 48H SANS ACTION) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <span>{fr.reinscription.lateReportsSectionTitle}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dossiers 'soumis' ou 'avis_comite' sans décision après {SEUIL_HEURES}h.
            </p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {rapportsEnRetard.length}
          </span>
        </div>

        {rapportsEnRetard.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            {fr.reinscription.lateReportsEmpty}
          </div>
        ) : (
          <div className="space-y-2.5">
            {rapportsEnRetard.map((r) => {
              const diffHours = r.soumisLe
                ? Math.max(0, Math.floor((now - new Date(r.soumisLe).getTime()) / (1000 * 60 * 60)))
                : 0;

              const waitingWho =
                r.statut === 'soumis'
                  ? fr.reinscription.waitingEncadrant
                  : fr.reinscription.waitingComite;

              return (
                <div
                  key={r.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{r.titre}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {r.annee}ᵉ année
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Doctorant : <span className="font-semibold text-slate-700">{r.doctorantId}</span> • {fr.reinscription.waitingPrefix} <span className="font-bold text-amber-800">{waitingWho}</span>
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        {fr.reinscription.timeElapsed} {diffHours} h
                      </span>
                      {r.relanceLe && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          Relancé le {new Date(r.relanceLe).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRelancerRapport(r.id)}
                    className="self-end sm:self-center px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98 shrink-0"
                  >
                    <Send size={13} />
                    <span>{fr.reinscription.btnRelancerReport}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
