'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Compass, Heart, History, ListMusic, Mic2, Settings, Menu, X } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  accent?: boolean;
}

const mainItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/explore', label: 'Explore', icon: Compass },
];

const libraryItems: NavItem[] = [
  { href: '/liked', label: 'Liked Songs', icon: Heart, accent: true },
  { href: '/recent', label: 'Recently Played', icon: History },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/artists', label: 'Saved Artists', icon: Mic2 },
];

const preferenceItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderNavItem = (item: NavItem, index: number) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    
    // Sakura theme colors - variations of pink/gold
    const sakuraColors = [
      { rgb: '255,183,197', hex: '#ffb7c5', name: 'sakura-primary' },
      { rgb: '231,84,128', hex: '#e75480', name: 'sakura-deep' },
      { rgb: '255,215,0', hex: '#ffd700', name: 'gold' },
      { rgb: '158,42,75', hex: '#9e2a4b', name: 'sakura-dark' },
    ];
    
    const colorIndex = index % sakuraColors.length;
    const color = sakuraColors[colorIndex];
    
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium w-full relative overflow-hidden border transition-all text-gray-800"
        style={{
          color: isActive ? color.hex : 'rgb(31, 41, 55)',
          backgroundColor: isActive ? `rgba(${color.rgb}, 0.15)` : 'transparent',
          borderColor: isActive ? `rgba(${color.rgb}, 0.5)` : 'transparent',
          boxShadow: isActive ? `0 0 10px rgba(${color.rgb}, 0.3)` : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderColor = `rgba(${color.rgb}, 0.5)`;
            e.currentTarget.style.boxShadow = `0 0 10px rgba(${color.rgb}, 0.3)`;
            e.currentTarget.style.color = color.hex;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.color = 'rgb(31, 41, 55)';
          }
        }}
      >
        <Icon size={18} className="relative z-10" />
        <span className="relative z-10">{item.label}</span>
        {!isActive && (
          <div 
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(${color.rgb}, 0.1), transparent)`,
            }}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-miko-white/80 backdrop-blur-md border border-sakura-primary/30 rounded-lg p-2 text-sakura-deep hover:bg-miko-white/90 transition-colors shadow-lg"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <nav className={`fixed top-0 left-0 h-full z-40 bg-miko-white/30 backdrop-blur-md border-r border-sakura-primary/30 shadow-[0_0_20px_rgba(255,183,197,0.2)] transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } w-64`}>
        <div className="px-6 py-4 h-full flex flex-col">
          {/* Logo */}
          <div className="mb-6">
            <Link href="/" className="inline-block" onClick={() => setIsMobileMenuOpen(false)}>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-sakura-deep via-sakura-primary to-gold-accent bg-clip-text text-transparent hover:from-sakura-deep hover:via-sakura-primary hover:to-gold-accent transition-all" style={{ fontFamily: 'var(--font-playfair), serif', textShadow: '0 0 10px rgba(255, 183, 197, 0.5)', letterSpacing: '0.05em' }}>
                Evanescia
              </h1>
            </Link>
          </div>

          {/* Main Section */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-sakura-deep uppercase tracking-wider mb-2 px-4" style={{ textShadow: '0 0 5px rgba(255, 183, 197, 0.5)' }}>
              Main
            </h2>
            <div className="flex flex-col gap-1">
              {mainItems.map((item, index) => renderNavItem(item, index))}
            </div>
          </div>

          {/* My Library Section */}
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-sakura-deep uppercase tracking-wider mb-2 px-4" style={{ textShadow: '0 0 5px rgba(255, 183, 197, 0.5)' }}>
              My Library
            </h2>
            <div className="flex flex-col gap-1">
              {libraryItems.map((item, index) => renderNavItem(item, index + mainItems.length))}
            </div>
            {/* Yae Sakura Image under Saved Artists - Hidden on mobile */}
            <div className="mt-3 px-4 hidden md:block">
              <div className="bg-miko-white/20 backdrop-blur-sm border border-sakura-primary/20 rounded-lg overflow-hidden">
                <div className="w-full max-h-48 flex items-center justify-center">
                  <img
                    src="/yae-sakura.png"
                    alt="Yae Sakura"
                    className="w-full h-full max-h-48 object-contain p-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences Section - At Bottom */}
          <div className="mt-auto pt-4 border-t border-sakura-primary/30">
            <div className="flex flex-col gap-1">
              {preferenceItems.map((item, index) => renderNavItem(item, index + mainItems.length + libraryItems.length))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
