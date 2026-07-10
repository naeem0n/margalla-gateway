import React, { useState, useEffect } from 'react';

export default function GhostModeGlobalBar() {
  // Impersonation States (Piche active triggers)
  const [isImpersonating, setIsImpersonating] = useState(false); 
  const [activeTarget, setActiveTarget] = useState<'resident' | 'vault'>('resident'); // Switcher target

  useEffect(() => {
    const checkImpersonating = () => {
      const imp = localStorage.getItem("mgt_impersonating") === "true";
      const target = (localStorage.getItem("mgt_impersonate_target") as 'resident' | 'vault') || 'resident';
      setIsImpersonating(imp);
      setActiveTarget(target);
    };

    checkImpersonating();

    // Listen for changes
    window.addEventListener("storage", checkImpersonating);
    
    // Also set up a small interval check as localStorage events don't fire on the same window
    const interval = setInterval(checkImpersonating, 1000);

    return () => {
      window.removeEventListener("storage", checkImpersonating);
      clearInterval(interval);
    };
  }, []);

  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const isResidentOrPartnerPage = hash.startsWith("#/resident") || hash.startsWith("#/partner");

  if (!isImpersonating || !isResidentOrPartnerPage) return null;

  const handleExit = () => {
    const adminToken = localStorage.getItem("mgt_admin_token");
    if (adminToken) {
      localStorage.setItem("mgt_api_token", adminToken);
      localStorage.removeItem("mgt_admin_token");
    } else {
      localStorage.removeItem("mgt_api_token");
    }
    localStorage.removeItem("mgt_impersonating");
    localStorage.removeItem("mgt_impersonate_target");
    window.location.href = "#/admin";
  };

  return (
    /* ⚠️ PERSISTENT FLOATING BAR - NOT PRINTABLE (Print ke waqt khud chup jaye gi) */
    <div className="w-full bg-gradient-to-r from-amber-600 via-red-600 to-amber-600 text-white p-3 text-center text-xs font-black tracking-wider shadow-2xl flex items-center justify-center gap-4 print:hidden sticky top-0 z-[9999]">
      <div>
        ⚠️ GHOST MODE ACTIVE: Viewing 
        <span className="bg-slate-950 px-2 py-0.5 rounded mx-1 text-yellow-400">
          {activeTarget === 'resident' ? '👥 RESIDENT PORTAL' : '⚙️ THIRD-PARTY VAULT LOGS'}
        </span> 
        as Super Admin.
      </div>

      {/* 🔙 RETURN BUTTON (Instantly routes back to Master Admin panel) */}
      <button 
        onClick={handleExit}
        className="bg-white hover:bg-gray-100 text-slate-950 px-3 py-1 rounded-lg font-extrabold transition uppercase tracking-wide text-[11px] shadow-md"
      >
        🔙 Exit & Return to Admin Panel
      </button>
    </div>
  );
}
