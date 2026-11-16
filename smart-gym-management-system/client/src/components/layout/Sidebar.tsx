import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, ClipboardList, QrCode, ScanFace, CalendarCheck,
  Dumbbell, Wallet, Bell, BarChart3, Settings, UserCircle, History, TicketCheck,
  ScanLine, HeartPulse, UserCog, LogOut, Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; }

const ADMIN: Role[] = ['super_admin', 'gym_admin'];
const STAFF: Role[] = ['super_admin', 'gym_admin', 'receptionist'];

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ADMIN },
  { to: '/reception', label: 'Reception Desk', icon: TicketCheck, roles: ['receptionist'] },
  { to: '/members', label: 'Members', icon: Users, roles: STAFF },
  { to: '/plans', label: 'Membership Plans', icon: Layers, roles: STAFF },
  { to: '/memberships', label: 'Memberships', icon: ClipboardList, roles: STAFF },
  { to: '/qr-generator', label: 'QR Generator', icon: QrCode, roles: STAFF },
  { to: '/qr-scanner', label: 'QR Scanner', icon: ScanLine, roles: STAFF },
  { to: '/face-enroll', label: 'Face Enrollment', icon: ScanFace, roles: STAFF },
  { to: '/face-scanner', label: 'Face Check-In', icon: HeartPulse, roles: STAFF },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: STAFF },
  { to: '/trainers', label: 'Trainers', icon: Dumbbell, roles: STAFF },
  { to: '/payments', label: 'Payments', icon: Wallet, roles: STAFF },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: STAFF },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: [...STAFF, 'trainer', 'member'] },
  { to: '/users', label: 'User Accounts', icon: UserCog, roles: ADMIN },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ADMIN },
  // Trainer
  { to: '/trainer-dashboard', label: 'My Dashboard', icon: LayoutDashboard, roles: ['trainer'] },
  { to: '/trainer-members', label: 'My Members', icon: Users, roles: ['trainer'] },
  // Member portal
  { to: '/portal', label: 'My Dashboard', icon: LayoutDashboard, roles: ['member'] },
  { to: '/portal/qr', label: 'My QR Code', icon: QrCode, roles: ['member'] },
  { to: '/portal/membership', label: 'My Membership', icon: CreditCard, roles: ['member'] },
  { to: '/portal/attendance', label: 'My Attendance', icon: History, roles: ['member'] },
  { to: '/portal/profile', label: 'My Profile', icon: UserCircle, roles: ['member'] },
];

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin', gym_admin: 'Gym Admin', receptionist: 'Receptionist', trainer: 'Trainer', member: 'Member',
};

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV.filter(i => i.roles.includes(user.role));
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-slate-300 flex flex-col transition-transform lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="bg-brand-600 rounded-lg p-2"><Dumbbell className="size-5 text-white" /></div>
          <div>
            <p className="text-white font-bold leading-tight">Smart Gym</p>
            <p className="text-[11px] text-slate-400 leading-tight">Management System</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto nice-scroll px-3 py-4 space-y-1">
          {items.map(item => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-600 text-white' : 'hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-brand-600/20 text-brand-300 flex items-center justify-center font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
            </div>
            <button onClick={() => void logout()} className="text-slate-400 hover:text-white" title="Log out">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
