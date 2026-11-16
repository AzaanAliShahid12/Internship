import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
