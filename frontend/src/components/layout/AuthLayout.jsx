import React from 'react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#faf9f8] p-4 text-[#242424]">
      <div className="w-full max-w-md bg-white border border-[#edebe9] rounded-lg shadow-lg p-8">
        {children}
      </div>
    </div>
  );
}
