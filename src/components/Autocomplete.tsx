import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { fr } from '../i18n/fr';

interface AutocompleteProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void;
  options: string[];
  minChars?: number;
}

// Nettoyage pour insensibilité casse et accents
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const Autocomplete: React.FC<AutocompleteProps> = ({
  id,
  placeholder = '',
  value,
  onChange,
  onSelect,
  options,
  minChars = 2,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions : 5 premières à l'ouverture (< 2 lettres) ou filtrées dès 2 lettres tapées
  const filteredOptions = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed.length < minChars) {
      return options.slice(0, 5);
    }
    const normalizedInput = normalizeText(trimmed);
    return options.filter((opt) => normalizeText(opt).includes(normalizedInput));
  }, [value, options, minChars]);

  // Clic extérieur pour fermer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectOption = (opt: string) => {
    onChange(opt);
    if (onSelect) {
      onSelect(opt);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Navigation clavier : ↑, ↓, Entrée, Échap
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(filteredOptions[highlightedIndex]);
      } else if (onSelect && value.trim()) {
        onSelect(value.trim());
        setIsOpen(false);
      }
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearInput = () => {
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full text-xs p-2.5 pr-8 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
        />

        {value ? (
          <button
            type="button"
            onClick={clearInput}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-[70] left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl text-xs py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = opt === value;
              return (
                <li
                  key={`${opt}-${idx}`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt);
                  }}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-emerald-50 text-emerald-900 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={12} className="text-emerald-600 shrink-0 ml-2" />}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-slate-400 italic text-center select-none">
              {fr.sujetsModule.noResult}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

