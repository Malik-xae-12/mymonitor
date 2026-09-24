import React from 'react';

export default function Input({
  label,
  error,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label className="text-xs font-medium text-[#242424]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-2.5 text-[#605e5c] pointer-events-none">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <input
          className={`w-full bg-white border rounded px-3 py-1.5 text-xs text-[#242424] placeholder-[#a19f9d] focus:outline-none focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd] transition ${
            Icon ? 'pl-8' : ''
          } ${error ? 'border-[#d13438]' : 'border-[#d1d1d1]'} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <span className="text-[11px] text-[#d13438]">{error}</span>
      )}
    </div>
  );
}
