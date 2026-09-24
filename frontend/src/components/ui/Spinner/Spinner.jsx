import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 'md', className = '', label = null }) {
  const sizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-[#0f6cbd]`} />
      {label && <span className="text-xs text-[#605e5c]">{label}</span>}
    </div>
  );
}
