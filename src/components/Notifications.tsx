import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Notification } from '../types';
import { fr } from '../i18n/fr';
import { getMatchingCandidateIdsForEmail } from '../utils/messages';

interface NotificationsProps {
  candidatId?: string;
  candidatEmail?: string;
  onNavigateToDossier: () => void;
  onNavigateToEntretiens?: () => void;
}

export const Notifications: React.FC<NotificationsProps> = ({
  candidatId,
  candidatEmail,
  onNavigateToDossier,
  onNavigateToEntretiens,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isForCurrentCandidate = (n: Notification): boolean => {
    const cleanEmail = candidatEmail?.trim().toLowerCase();
    const matchingIds = getMatchingCandidateIdsForEmail(candidatId, cleanEmail);
    if (!candidatId && !cleanEmail) return true;
    if (matchingIds.has(n.destinataireId)) return true;
    if (candidatId && n.destinataireId === 'cand-001') return true;
    if (cleanEmail && n.destinataireEmail?.trim().toLowerCase() === cleanEmail) return true;
    return false;
  };

  const loadNotifications = () => {
    try {
      const raw = localStorage.getItem('usmba_notifications');
      if (raw) {
        const parsed: Notification[] = JSON.parse(raw);
        // Filtrer par candidat connecté (ID ou e-mail d'inscription)
        const userNotifs = parsed.filter(isForCurrentCandidate);
        setNotifications(userNotifs);
        return;
      }
    } catch {
      // safe fallback
    }
    setNotifications([]);
  };

  useEffect(() => {
    loadNotifications();
    const handleSync = () => loadNotifications();
    window.addEventListener('usmba_notifications_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('usmba_notifications_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [candidatId, candidatEmail]);

  // Fermer la liste déroulante au clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.lue).length;

  const handleToggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    // Ouvrir la liste marque les notifications comme lues
    if (nextOpen && unreadCount > 0) {
      try {
        const raw = localStorage.getItem('usmba_notifications');
        if (raw) {
          const parsed: Notification[] = JSON.parse(raw);
          const updated = parsed.map((n) => {
            if (isForCurrentCandidate(n)) {
              return { ...n, lue: true };
            }
            return n;
          });
          localStorage.setItem('usmba_notifications', JSON.stringify(updated));
          setNotifications(updated.filter(isForCurrentCandidate));
          window.dispatchEvent(new CustomEvent('usmba_notifications_updated'));
        }
      } catch (err) {
        console.error('Storage error marking notifications read', err);
      }
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Icône cloche avec badge */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label={fr.notifications.title}
        title={fr.notifications.title}
        className={`relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-emerald-800 text-amber-300 ring-1 ring-amber-300/40'
            : 'text-emerald-100 hover:text-white hover:bg-emerald-900/60'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-xs font-bold bg-amber-400 text-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Liste déroulante */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 pb-2 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs tracking-tight">
              {fr.notifications.title}
            </h4>
            <span className="text-[10px] text-slate-400">
              {notifications.length} message(s)
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 px-1 py-1">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                {fr.notifications.empty}
              </div>
            ) : (
              notifications.map((notif) => {
                const isEntretiensNotif =
                  notif.texte.toLowerCase().includes('entretiens') ||
                  notif.texte.toLowerCase().includes('résultat');

                return (
                  <div key={notif.id} className="p-2.5 hover:bg-slate-50 rounded-xl transition space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{formatDate(notif.date)}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-snug font-medium">
                      {notif.texte}
                    </p>
                    {notif.type === 'action' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          if ((notif.actionTab === 'entretiens' || isEntretiensNotif) && onNavigateToEntretiens) {
                            onNavigateToEntretiens();
                          } else {
                            onNavigateToDossier();
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer active:scale-98 transition-colors mt-1"
                      >
                        <span>{notif.actionLabel || fr.notifications.btnCompleterDossier}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
