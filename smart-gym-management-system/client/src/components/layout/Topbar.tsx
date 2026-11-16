import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [liveUnread, setLiveUnread] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationsApi.list({ limit: 1, unread: 'true' }),
    enabled: Boolean(user),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => setLiveUnread(prev => (prev ?? data?.unread ?? 0) + 1);
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [data?.unread]);

  const unread = liveUnread ?? data?.unread ?? 0;
  const canSearch = user && ['super_admin', 'gym_admin', 'receptionist'].includes(user.role);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6">
      <button className="lg:hidden text-slate-600" onClick={onMenu} aria-label="Open menu"><Menu className="size-6" /></button>
      {canSearch ? (
        <form
          className="relative flex-1 max-w-md hidden sm:block"
          onSubmit={e => { e.preventDefault(); navigate(`/members?search=${encodeURIComponent(search)}`); }}
        >
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members by name, ID, phone…"
            className="w-full h-9 rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
          />
        </form>
      ) : <div className="flex-1" />}
      <Link to="/notifications" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Notifications">
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
      <div className="hidden sm:block text-right">
        <p className="text-sm font-medium text-slate-800 leading-tight">{user?.name}</p>
        <p className="text-xs text-slate-500 leading-tight">{user?.email}</p>
      </div>
    </header>
  );
}
