import React from 'react';

/**
 * Imagen chica del competidor en filas "vs": escudo si es equipo, avatar si es
 * participante. No renderiza nada sin URL y se oculta sola si la imagen falla.
 */
export const CompetitorBadge: React.FC<{ url?: string | null; name: string; size?: 'sm' | 'md' }> = ({
  url,
  name,
  size = 'sm',
}) => {
  if (!url) return null;
  const sizeCls = size === 'md' ? 'h-6 w-6' : 'h-4 w-4';
  return (
    <img
      src={url}
      alt={`Imagen de ${name}`}
      className={`${sizeCls} flex-none rounded-full object-cover`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};
