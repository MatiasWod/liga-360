import React from 'react';
import type { NavItem, NavItemId } from '../../types/domain';

interface SidebarProps {
  active: NavItemId;
  onNavigate: (item: NavItemId) => void;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, items }) => {
  return (
    <aside className="hidden w-64 shrink-0 self-stretch bg-[#163A20] p-4 lg:block">
      <nav className="space-y-2">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                selected
                  ? 'bg-[#66BB6A] text-[#0F2A33]'
                  : 'text-slate-100 hover:bg-[#22512D]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

