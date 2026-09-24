import React from 'react';

export default function Badge({
  children,
  variant = 'default', // 'default' | 'success' | 'warning' | 'danger' | 'info'
  size = 'sm',
  className = '',
}) {
  const variantStyles = {
    default: 'bg-[#f3f2f1] text-[#605e5c] border-[#e1dfdd]',
    success: 'bg-[#dff6dd] text-[#107c41] border-[#107c41]/30',
    warning: 'bg-[#fff4ce] text-[#797775] border-[#797775]/30',
    danger: 'bg-[#fde7e9] text-[#a80000] border-[#a80000]/30',
    info: 'bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/30',
  }[variant] || 'bg-[#f3f2f1] text-[#605e5c] border-[#e1dfdd]';

  const sizeStyles = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center font-medium rounded border ${variantStyles} ${sizeStyles} ${className}`}>
      {children}
    </span>
  );
}
