import React from 'react';
import { UserCheck, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';
import { fr } from '../i18n/fr';

interface RoleSelectorProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentRole,
  onRoleChange,
}) => {
  const roles: {
    id: UserRole;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'candidat',
      label: fr.roles.candidat,
      desc: fr.roles.candidatDesc,
      icon: <UserCheck size={18} />,
    },
    {
      id: 'enseignant',
      label: fr.roles.enseignant,
      desc: fr.roles.enseignantDesc,
      icon: <BookOpenCheck size={18} />,
    },
    {
      id: 'directeur_ced',
      label: fr.roles.directeurCed,
      desc: fr.roles.directeurCedDesc,
      icon: <ShieldCheck size={18} />,
    },
  ];

  const activeRoleData = roles.find((r) => r.id === currentRole) || roles[0];

  return (
    <div className="bg-slate-900 text-white p-3 border-b border-slate-800">
      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium tracking-wide uppercase text-slate-400">
            {fr.roles.selectorTitle}
          </span>
          <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
            {activeRoleData.icon}
            {activeRoleData.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          {roles.map((r) => {
            const isActive = currentRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onRoleChange(r.id)}
                type="button"
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg text-xs font-semibold transition-all duration-150 min-h-[48px] active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="mb-0.5">{r.icon}</span>
                <span className="truncate w-full text-center">{r.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 mt-2 px-1 text-center">
          {activeRoleData.desc}
        </p>
      </div>
    </div>
  );
};
