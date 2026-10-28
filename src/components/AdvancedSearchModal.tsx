import React, { useState, useEffect } from 'react';
import { X, Plus, Filter, RotateCcw } from 'lucide-react';
import { Autocomplete } from './Autocomplete';
import { fr } from '../i18n/fr';

export interface AdvancedFilterCriteria {
  encadrant: string;
  discipline: string;
  structure: string;
  keywords: string[];
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: AdvancedFilterCriteria;
  onApply: (criteria: AdvancedFilterCriteria) => void;
  onReset: () => void;
  // Données pour autocomplétion
  encadrantOptions: string[];
  disciplineOptions: string[];
  structureOptions: string[];
  keywordOptions: string[];
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  criteria,
  onApply,
  onReset,
  encadrantOptions,
  disciplineOptions,
  structureOptions,
  keywordOptions,
}) => {
  const [localEncadrant, setLocalEncadrant] = useState(criteria.encadrant);
  const [localDiscipline, setLocalDiscipline] = useState(criteria.discipline);
  const [localStructure, setLocalStructure] = useState(criteria.structure);
  const [localKeywords, setLocalKeywords] = useState<string[]>(criteria.keywords);
  const [keywordInput, setKeywordInput] = useState('');

  // Synchronisation à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setLocalEncadrant(criteria.encadrant);
      setLocalDiscipline(criteria.discipline);
      setLocalStructure(criteria.structure);
      setLocalKeywords(criteria.keywords);
      setKeywordInput('');
    }
  }, [isOpen, criteria]);

  // Fermeture par Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !localKeywords.includes(trimmed)) {
      setLocalKeywords([...localKeywords, trimmed]);
    }
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setLocalKeywords(localKeywords.filter((k) => k !== kw));
  };

  const handleApply = () => {
    // Si un mot-clé est saisi sans avoir cliqué, on l'ajoute
    let finalKeywords = [...localKeywords];
    if (keywordInput.trim() && !finalKeywords.includes(keywordInput.trim())) {
      finalKeywords.push(keywordInput.trim());
    }

    onApply({
      encadrant: localEncadrant.trim(),
      discipline: localDiscipline.trim(),
      structure: localStructure.trim(),
      keywords: finalKeywords,
    });
    onClose();
  };

  const handleResetLocal = () => {
    setLocalEncadrant('');
    setLocalDiscipline('');
    setLocalStructure('');
    setLocalKeywords([]);
    setKeywordInput('');
    onReset();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Conteneur modal : feuille en bas sur mobile, fenêtré max 480px sur desktop */}
      <div
        className="w-full md:max-w-[480px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de la popup */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {fr.sujetsModule.advancedSearchTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corps des critères */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Encadrant */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.sujetsModule.encadrantLabel}
            </label>
            <Autocomplete
              placeholder={fr.sujetsModule.autocompleteEncadrantPlaceholder}
              value={localEncadrant}
              onChange={setLocalEncadrant}
              options={encadrantOptions}
            />
          </div>

          {/* Filière / discipline */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.sujetsModule.disciplineLabel}
            </label>
            <Autocomplete
              placeholder={fr.sujetsModule.autocompleteDisciplinePlaceholder}
              value={localDiscipline}
              onChange={setLocalDiscipline}
              options={disciplineOptions}
            />
          </div>

          {/* Structure / laboratoire */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.sujetsModule.structureLabel}
            </label>
            <Autocomplete
              placeholder={fr.sujetsModule.autocompleteStructurePlaceholder}
              value={localStructure}
              onChange={setLocalStructure}
              options={structureOptions}
            />
          </div>

          {/* Mots-clés (sélection multiple en puces) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {fr.sujetsModule.keywordsLabel}
            </label>
            <div className="space-y-1.5">
              <Autocomplete
                placeholder={fr.sujetsModule.autocompleteKeywordPlaceholder}
                value={keywordInput}
                onChange={(val) => {
                  setKeywordInput(val);
                  // Si l'utilisateur clique sur une suggestion exacte, on l'ajoute
                  if (keywordOptions.includes(val)) {
                    handleAddKeyword(val);
                  }
                }}
                options={keywordOptions.filter((k) => !localKeywords.includes(k))}
              />

              {localKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {localKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full"
                    >
                      <span>#{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetLocal}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
          >
            <RotateCcw size={13} />
            <span>{fr.sujetsModule.btnReset}</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-lg transition active:scale-95 shadow-xs"
          >
            {fr.sujetsModule.btnApply}
          </button>
        </div>
      </div>
    </div>
  );
};
