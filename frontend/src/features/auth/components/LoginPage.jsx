import React from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { env } from '../../../config/env';

/**
 * Fabric-native sign-in screen. Purpose is stated plainly so the user
 * immediately understands this is organization (Entra ID) sign-in.
 */
export default function LoginPage() {
  const { login, error } = useAuth();

  return (
    <div className="min-h-screen w-full bg-[#faf9f8] text-[#242424] flex items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-sm bg-white border border-[#edebe9] rounded-lg shadow-xl overflow-hidden">
        <div className="h-1.5 bg-[#0f6cbd]" />
        <div className="p-7 space-y-5">
          {/* Header Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#eff6fc] text-[#0f6cbd] flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="fabric_grad1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#1177D7" />
                    <stop offset="50%" stopColor="#00A2ED" />
                    <stop offset="100%" stopColor="#00B7C3" />
                  </linearGradient>
                </defs>
                <path d="M16 3 L29 16 L16 29 L3 16 Z" fill="url(#fabric_grad1)" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-[#242424]">Microsoft Fabric</h1>
              <p className="text-xs text-[#605e5c]">Real-Time Monitoring & Telemetry Hub</p>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[#242424]">Sign in to your organization</h2>
            <p className="text-xs text-[#605e5c] leading-relaxed">
              Use your Microsoft Entra ID (Azure AD) work account. Role access and pipeline L1/L2 scope will be applied.
            </p>
          </div>

          {/* Microsoft 4-Color Sign In Button */}
          <button
            type="button"
            onClick={login}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#8a8886] hover:border-[#242424] text-xs font-semibold transition shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
          >
            {/* Microsoft 4-color grid icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span>Sign in with Microsoft</span>
          </button>

          {error && (
            <p className="text-xs text-[#a80000] bg-[#fdf2f2] border border-[#fecaca] rounded p-2.5 break-words">
              {error.message || 'Sign-in failed. Please try again.'}
            </p>
          )}

          <div className="pt-3 border-t border-[#edebe9] text-[11px] text-[#797775] space-y-1">
            <p>Configured for Microsoft Entra ID Tenant:</p>
            <p className="font-mono text-[10px] text-[#605e5c]">{env.azureTenantId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
