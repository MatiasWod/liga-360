import React from 'react';
import type { NavItem, NavItemId } from '../../types/domain';

interface SidebarProps {
  active: NavItemId;
  onNavigate: (item: NavItemId) => void;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, items }) => {
  return (
    <aside className="hidden w-64 shrink-0 self-stretch border-r border-border-subtle bg-surface-1 p-4 lg:block">
      <nav className="space-y-2">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${
                selected
                  ? 'bg-accent-soft text-text-primary border border-accent-primary/40'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
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
