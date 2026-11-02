import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

interface AutocompleteProps {
  id?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
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
  options,
  minChars = 2,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions filtrées insensibles aux accents et à la casse
  const filteredOptions = useMemo(() => {
    if (value.trim().length < minChars) return [];
    const normalizedInput = normalizeText(value);
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

  // Navigation clavier : ↑, ↓, Entrée, Échap
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && filteredOptions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        selectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setHighlightedIndex(-1);
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
            if (value.trim().length >= minChars) {
              setIsOpen(true);
            }
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg text-xs py-1">
          {filteredOptions.map((opt, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isSelected = opt === value;
            return (
              <li
                key={opt}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => selectOption(opt)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                  isHighlighted ? 'bg-emerald-50 text-emerald-900 font-medium' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && <Check size={12} className="text-emerald-600 shrink-0 ml-2" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
