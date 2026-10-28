import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileCheck2,
} from 'lucide-react';
import { PieceStatut, CreneauStatut } from '../types';
import { fr } from '../i18n/fr';

interface StatusBadgeProps {
  type: 'piece' | 'creneau' | 'candidature';
  statut?: PieceStatut | CreneauStatut | 'deposee';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  statut,
  size = 'md',
}) => {
  const isSmall = size === 'sm';
  const sizeClass = isSmall ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const iconSize = isSmall ? 13 : 16;

  if (type === 'candidature') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClass}`}
      >
        <FileCheck2 size={iconSize} className="text-emerald-600 shrink-0" />
        <span>{fr.sujetsModule.candidatureDeposeeBadge}</span>
      </span>
    );
  }

  if (type === 'piece') {
    const s = statut as PieceStatut;
    switch (s) {
      case 'prouvee':
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClass}`}
          >
            <CheckCircle2 size={iconSize} className="text-emerald-600 shrink-0" />
            <span>{fr.statutsPiece.prouvee.label}</span>
          </span>
        );
      case 'declaree':
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClass}`}
          >
            <Clock size={iconSize} className="text-amber-600 shrink-0" />
            <span>{fr.statutsPiece.declaree.label}</span>
          </span>
        );
      case 'illisible':
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-800 border border-rose-200 ${sizeClass}`}
          >
            <AlertTriangle size={iconSize} className="text-rose-600 shrink-0" />
            <span>{fr.statutsPiece.illisible.label}</span>
          </span>
        );
      case 'absente':
      default:
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClass}`}
          >
            <XCircle size={iconSize} className="text-slate-500 shrink-0" />
            <span>{fr.statutsPiece.absente.label}</span>
          </span>
        );
    }
  }

  // Type créneau
  const c = statut as CreneauStatut;
  switch (c) {
    case 'confirme':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClass}`}
        >
          <FileCheck2 size={iconSize} className="text-emerald-600 shrink-0" />
          <span>{fr.statutsCreneau.confirme.label}</span>
        </span>
      );
    case 'reserve':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClass}`}
        >
          <Clock size={iconSize} className="text-amber-600 shrink-0" />
          <span>{fr.statutsCreneau.reserve.label}</span>
        </span>
      );
    case 'libre':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-sky-50 text-sky-800 border border-sky-200 ${sizeClass}`}
        >
          <CheckCircle2 size={iconSize} className="text-sky-600 shrink-0" />
          <span>{fr.statutsCreneau.libre.label}</span>
        </span>
      );
  }
};
