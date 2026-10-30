import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, AlertCircle, Clock, MapPin, UserCheck } from 'lucide-react';
import { Creneau, CreneauStatut, Candidat } from '../types';
import { fr } from '../i18n/fr';
import { StatusBadge } from './StatusBadge';
import { storageService } from '../services/storage';

const STORAGE_KEY_CRENEAUX = 'usmba_doctorat_creneaux';
const STORAGE_KEY_CANDIDAT = 'usmba_doctorat_candidat';

interface MesCreneauxProps {
  enseignantId?: string;
}

export const MesCreneaux: React.FC<MesCreneauxProps> = ({
  enseignantId = 'ens-1',
}) => {
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const [lieu, setLieu] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Charger les créneaux depuis le localStorage au montage
  useEffect(() => {
    loadCreneaux();
  }, []);

  const loadCreneaux = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) {
        setCreneaux(JSON.parse(raw));
      } else {
        const initial = storageService.getCreneaux();
        setCreneaux(initial);
      }
    } catch {
      setCreneaux(storageService.getCreneaux());
    }
  };

  // Nom du candidat associé à une réservation
  const getCandidatNom = (candidatId?: string): string => {
    if (!candidatId) return '';
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CANDIDAT);
      if (raw) {
        const c: Candidat = JSON.parse(raw);
        if (c.id === candidatId && c.nom) return c.nom;
      }
    } catch {
      // safe fallback
    }

    const demoMap: Record<string, string> = {
      'cand-001': 'Yassine El Fassi',
      'cand-salma': 'Salma Alami',
      'cand-khadija': 'Khadija Tazi',
      'visiteur-001': 'Yassine El Fassi',
    };
    return demoMap[candidatId] || `Candidat (${candidatId})`;
  };

  // Sauvegarder dans le localStorage
  const saveCreneaux = (updatedList: Creneau[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(updatedList));
      setCreneaux(updatedList);
      setErrorMsg(null);
      return true;
    } catch {
      setErrorMsg(fr.mesCreneaux.storageQuotaError);
      return false;
    }
  };

  // Ajout d'un nouveau créneau
  const handleAddCreneau = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedDate = date.trim();
    const trimmedHeure = heure.trim();
    const trimmedLieu = lieu.trim();

    if (!trimmedDate || !trimmedHeure || !trimmedLieu) {
      setErrorMsg(fr.mesCreneaux.requiredFieldsError);
      return;
    }

    // Lire l'état frais depuis localStorage pour éviter les désynchronisations
    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    // Règle de conflit : même enseignant, même date et même heure
    const hasConflict = currentList.some(
      (c) =>
        c.enseignantId === enseignantId &&
        c.date === trimmedDate &&
        c.heure === trimmedHeure
    );

    if (hasConflict) {
      setErrorMsg(fr.mesCreneaux.conflictError);
      return;
    }

    const newCreneau: Creneau = {
      id: `cr-${Date.now()}`,
      enseignantId,
      date: trimmedDate,
      heure: trimmedHeure,
      lieu: trimmedLieu,
      statut: 'libre',
    };

    const updated = [...currentList, newCreneau];
    if (saveCreneaux(updated)) {
      setDate('');
      setHeure('');
      setLieu('');
    }
  };

  // Suppression d'un créneau (uniquement si statut libre)
  const handleDeleteCreneau = (id: string) => {
    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    const target = currentList.find((c) => c.id === id);
    if (!target || target.statut !== 'libre') return;

    const updated = currentList.filter((c) => c.id !== id);
    saveCreneaux(updated);
  };

  // Créneaux de cet enseignant, triés par date puis heure
  const mySlots = creneaux
    .filter((c) => c.enseignantId === enseignantId)
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.heure.localeCompare(b.heure);
    });

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.mesCreneaux.title}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {mySlots.length} {mySlots.length > 1 ? 'créneaux publiés' : 'créneau publié'}
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
          <Calendar size={18} />
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
          <Plus size={14} className="text-emerald-700" />
          <span>{fr.mesCreneaux.formTitle}</span>
        </h3>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAddCreneau} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {fr.mesCreneaux.dateLabel}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {fr.mesCreneaux.heureLabel}
              </label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {fr.mesCreneaux.lieuLabel}
            </label>
            <input
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder={fr.mesCreneaux.lieuPlaceholder}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              required
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{fr.mesCreneaux.btnAdd}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Liste des créneaux de l'enseignant */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide px-1">
          {fr.mesCreneaux.listTitle}
        </h3>

        {mySlots.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            {fr.mesCreneaux.emptyList}
          </div>
        ) : (
          <div className="space-y-2">
            {mySlots.map((slot) => {
              const isReservedOrConfirmed =
                slot.statut === 'reserve' || slot.statut === 'confirme';
              const candidatNom = isReservedOrConfirmed
                ? getCandidatNom(slot.candidatId)
                : '';

              return (
                <div
                  key={slot.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Clock size={13} className="text-slate-500" />
                        <span>{slot.date} à {slot.heure}</span>
                      </span>
                      <StatusBadge
                        type="creneau"
                        statut={slot.statut as CreneauStatut}
                        size="sm"
                      />
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span>{slot.lieu}</span>
                    </p>

                    {isReservedOrConfirmed && candidatNom && (
                      <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 inline-flex items-center gap-1 mt-1">
                        <UserCheck size={12} className="text-emerald-700" />
                        <span>{fr.mesCreneaux.candidatPrefix} {candidatNom}</span>
                      </p>
                    )}
                  </div>

                  {slot.statut === 'libre' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCreneau(slot.id)}
                      className="self-end sm:self-center px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>{fr.mesCreneaux.btnDelete}</span>
                    </button>
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
