import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'subtle' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium transition select-none disabled:opacity-50 disabled:cursor-not-allowed rounded";

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-xs gap-2",
    lg: "px-4 py-2 text-sm gap-2.5",
  }[size] || "px-3.5 py-1.5 text-xs gap-2";

  const variantStyles = {
    primary: "bg-[#0f6cbd] text-white hover:bg-[#0f6cbd]/90 shadow-2xs",
    secondary: "bg-white text-[#242424] border border-[#d1d1d1] hover:bg-[#f3f2f1]",
    subtle: "bg-transparent text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#242424]",
    danger: "bg-[#d13438] text-white hover:bg-[#d13438]/90",
  }[variant] || "bg-[#0f6cbd] text-white";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </button>
  );
}
