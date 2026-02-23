import React from 'react';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({ name, imageUrl, size = 'md' }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={`${sizeMap[size]} rounded-full object-cover`} />;
  }

  return (
    <div className={`${sizeMap[size]} inline-flex items-center justify-center rounded-full bg-[#0F2A33] font-semibold text-white`}>
      {initials || 'U'}
    </div>
  );
};

