"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import Logo from './Logo'

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { t, toggleLanguage } = useLanguage();

  // Exclude navbar completely on login and register pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="px-4 lg:px-32 mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          <Logo className="text-white w-12 "/>
        </Link>

        <div className="flex items-center gap-3">
          {/* Language Switch Button */}
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-white text-black transition"
          >
            {t.navbar.switchLang}
          </button>

          {/* User Status / Guest State */}
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                />
              )}
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {user.displayName || user.email}
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold rounded-lg transition"
              >
                {t.navbar.signOut}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
                {t.navbar.guestBadge}
              </span>
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
              >
                {t.navbar.saveCloud}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}