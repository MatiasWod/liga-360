import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ headers, children }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-1">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-2/60">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-text-primary">{children}</tbody>
        </table>
      </div>
    </div>
  );
};
