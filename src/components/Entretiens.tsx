import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle2, AlertCircle, RefreshCw, Bell, User } from 'lucide-react';
import { Creneau, CreneauStatut, Candidat, Sujet, Enseignant } from '../types';
import { fr } from '../i18n/fr';
import { StatusBadge } from './StatusBadge';
import { storageService } from '../services/storage';

const STORAGE_KEY_CRENEAUX = 'usmba_doctorat_creneaux';
const STORAGE_KEY_CANDIDAT = 'usmba_doctorat_candidat';

export const Entretiens: React.FC = () => {
  const [candidat, setCandidat] = useState<Candidat>(storageService.getCandidat());
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [sujets, setSujets] = useState<Sujet[]>([]);
  const [enseignants, setEnseignants] = useState<Enseignant[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const rawCand = localStorage.getItem(STORAGE_KEY_CANDIDAT);
      if (rawCand) {
        setCandidat(JSON.parse(rawCand));
      } else {
        setCandidat(storageService.getCandidat());
      }
    } catch {
      setCandidat(storageService.getCandidat());
    }

    try {
      const rawCr = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (rawCr) {
        setCreneaux(JSON.parse(rawCr));
      } else {
        setCreneaux(storageService.getCreneaux());
      }
    } catch {
      setCreneaux(storageService.getCreneaux());
    }

    setSujets(storageService.getSujets());
    setEnseignants(storageService.getEnseignants());
  };

  // Un candidat est « retenu » s'il a au moins une candidature de statut 'retenue'
  const candidaturesStatuts = candidat.candidaturesStatuts || {};
  const retainedSujetIds = Object.keys(candidaturesStatuts).filter(
    (id) => candidaturesStatuts[id] === 'retenue'
  );
  const isRetenu = retainedSujetIds.length > 0;

  // Enseignants dont les sujets ont retenu le candidat
  const retainedTeacherIds = sujets
    .filter((s) => retainedSujetIds.includes(s.id))
    .map((s) => s.enseignantId);

  // Nom d'un enseignant
  const getTeacherName = (enseignantId: string): string => {
    const ens = enseignants.find((e) => e.id === enseignantId);
    return ens ? `${ens.nom} (${ens.structure})` : 'Enseignant référent';
  };

  // Sauvegarde des créneaux dans localStorage
  const saveCreneaux = (updatedList: Creneau[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY_CRENEAUX, JSON.stringify(updatedList));
      setCreneaux(updatedList);
      setErrorMsg(null);
      return true;
    } catch {
      setErrorMsg(fr.entretiens.storageQuotaError);
      return false;
    }
  };

  // Mon créneau actif (réservé ou confirmé)
  const monCreneau = creneaux.find(
    (c) =>
      c.candidatId === candidat.id &&
      (c.statut === 'reserve' || c.statut === 'confirme')
  );

  const hasActiveBooking = Boolean(monCreneau);

  // Réserver un créneau
  const handleReserve = (slotId: string) => {
    setErrorMsg(null);
    if (hasActiveBooking) return;

    // Vérifie avant d'écrire que le créneau est toujours 'libre' dans localStorage
    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    const targetSlot = currentList.find((c) => c.id === slotId);
    if (!targetSlot || targetSlot.statut !== 'libre') {
      setErrorMsg(fr.entretiens.slotTakenError);
      setCreneaux(currentList);
      return;
    }

    const nowIso = new Date().toISOString();
    const updated = currentList.map((c) => {
      if (c.id === slotId) {
        return {
          ...c,
          statut: 'reserve' as CreneauStatut,
          candidatId: candidat.id,
          dateReservation: nowIso,
        };
      }
      return c;
    });

    saveCreneaux(updated);
  };

  // Confirmer son créneau en 1 clic
  const handleConfirm = () => {
    if (!monCreneau) return;

    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    const nowIso = new Date().toISOString();
    const updated = currentList.map((c) => {
      if (c.id === monCreneau.id) {
        return {
          ...c,
          statut: 'confirme' as CreneauStatut,
          dateConfirmation: nowIso,
        };
      }
      return c;
    });

    saveCreneaux(updated);
  };

  // Changer de créneau : remet le créneau précédent à 'libre'
  const handleChangeSlot = () => {
    if (!monCreneau) return;

    let currentList = creneaux;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRENEAUX);
      if (raw) currentList = JSON.parse(raw);
    } catch {
      // fallback
    }

    const updated = currentList.map((c) => {
      if (c.id === monCreneau.id) {
        const { candidatId, dateReservation, dateConfirmation, ...rest } = c;
        return {
          ...rest,
          statut: 'libre' as CreneauStatut,
        };
      }
      return c;
    });

    saveCreneaux(updated);
  };

  // Créneaux 'libre' des enseignants dont les sujets ont retenu le candidat, triés par date puis heure
  const availableSlots = creneaux
    .filter(
      (c) =>
        retainedTeacherIds.includes(c.enseignantId) &&
        c.statut === 'libre'
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.heure.localeCompare(b.heure);
    });

  // CAS 1 : Candidat NON retenu
  if (!isRetenu) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-amber-300">
              {fr.entretiens.title}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Auditions doctorales CED USMBA
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
            <Calendar size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 shadow-xs">
          <div className="w-11 h-11 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <Calendar size={22} />
          </div>
          <p className="text-sm font-medium text-slate-700 max-w-md mx-auto">
            {fr.entretiens.notRetainedNotice}
          </p>
        </div>
      </div>
    );
  }

  // CAS 2 : Candidat RETENU
  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-300">
            {fr.entretiens.title}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Candidature retenue : choisis et confirme ton créneau d'audition
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 flex items-center justify-center">
          <Calendar size={18} />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Carte « Mon entretien » en haut de l'écran si le candidat a un créneau */}
      {monCreneau && (
        <div className="bg-white border-2 border-emerald-600 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={15} className="text-emerald-700" />
              <span>{fr.entretiens.myInterviewTitle}</span>
            </h3>
            <StatusBadge
              type="creneau"
              statut={monCreneau.statut as CreneauStatut}
              size="sm"
            />
          </div>

          {/* Texte court sur 3 lignes */}
          <div className="space-y-1.5 text-xs text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <Clock size={13} className="text-emerald-700 shrink-0" />
              <span>{monCreneau.date} à {monCreneau.heure}</span>
            </p>
            <p className="text-slate-600 flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-500 shrink-0" />
              <span>{fr.entretiens.lieuPrefix} {monCreneau.lieu}</span>
            </p>
            <p className={`font-semibold flex items-center gap-1.5 ${
              monCreneau.statut === 'confirme' ? 'text-emerald-700' : 'text-amber-800'
            }`}>
              <CheckCircle2 size={13} className="shrink-0" />
              <span>
                {monCreneau.statut === 'reserve'
                  ? fr.entretiens.actionToConfirm
                  : fr.entretiens.actionConfirmed}
              </span>
            </p>
          </div>

          {/* Simulation d'envoi de rappel */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1.5 rounded-lg">
            <Bell size={12} className="text-amber-700 shrink-0" />
            <span>{fr.entretiens.reminderNotice}</span>
          </div>

          {/* Boutons d'actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {monCreneau.statut === 'reserve' && (
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                <CheckCircle2 size={14} />
                <span>{fr.entretiens.btnConfirm}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleChangeSlot}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>{fr.entretiens.btnChangeSlot}</span>
            </button>
          </div>
        </div>
      )}

      {/* Liste des créneaux disponibles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            {fr.entretiens.availableSlotsTitle}
          </h3>
          {hasActiveBooking && (
            <span className="text-[11px] text-slate-500">
              1 créneau actif max
            </span>
          )}
        </div>

        {availableSlots.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
            {fr.entretiens.noAvailableSlots}
          </div>
        ) : (
          <div className="space-y-2">
            {availableSlots.map((slot) => {
              const teacherName = getTeacherName(slot.enseignantId);

              return (
                <div
                  key={slot.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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

                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <User size={11} className="text-slate-400 shrink-0" />
                      <span>{teacherName}</span>
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      disabled={hasActiveBooking}
                      onClick={() => handleReserve(slot.id)}
                      className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        hasActiveBooking
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer active:scale-98'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>{fr.entretiens.btnReserve}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
