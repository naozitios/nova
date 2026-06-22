'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, LayoutDashboard, Megaphone, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SignUpModal from '@/components/landing/SignUpModal';
import SignInModal from './landing/SignInModal';
import { useAuth } from '@/context/AuthContext';

const loggedOutNavLinks = [
  { name: 'Features', href: '#features', icon: undefined },
  { name: 'How It Works', href: '#how-it-works', icon: undefined },
  { name: 'Demo', href: '/demo', icon: undefined },
];

const loggedInNavLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const { isLoggedIn, login, logout } = useAuth();
  const pathname = usePathname();

  const navLinks = isLoggedIn ? loggedInNavLinks : loggedOutNavLinks;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = (email: string) => {
    login({ id: '1', name: 'Demo User', email, company: 'Demo Agency' });
    setShowSignIn(false);
  };

  const handleSignUpClick = () => setShowSignUp(true);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || isLoggedIn ? 'py-3' : 'py-6'
        }`}
      >
        <div className="mx-auto px-6 md:px-12 lg:px-24">
          <div
            className={`rounded-full transition-all duration-300 ${
              scrolled || isLoggedIn
                ? 'bg-white/95 backdrop-blur-lg shadow-lg'
                : 'bg-white/80 backdrop-blur-md'
            } px-6 py-3`}
          >
            <div className="flex justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E55A3C] to-[#F4A574] flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🍾</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">Nova</span>
              </Link>

              {/* Desktop Nav */}
              {isLoggedIn ? (
                <nav className="hidden md:flex items-center ml-auto gap-2">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link key={link.name} href={link.href}>
                        <Button
                          variant={pathname === link.href ? 'default' : 'ghost'}
                          className={`font-medium text-sm ${
                            pathname === link.href
                              ? 'bg-stone-900 text-white'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                          {link.name}
                        </Button>
                      </Link>
                    );
                  })}
                </nav>
              ) : (
                <nav className="hidden md:flex items-center justify-center flex-1 gap-8">
                  {navLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      className="text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
                    >
                      {link.name}
                    </Link>
                  ))}
                </nav>
              )}

              {/* CTA */}
              <div className="hidden md:flex items-center gap-3">
                {isLoggedIn ? (
                  <Button variant="ghost" onClick={logout}>
                    Log Out
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="text-gray-600 hover:text-gray-900 font-medium"
                      onClick={() => setShowSignIn(true)}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="bg-[#E55A3C] hover:bg-[#D14A2E] text-white rounded-full px-6 font-medium group"
                      onClick={() => setShowSignUp(true)}
                    >
                      Get Started
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 text-gray-600"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mx-6 mt-3"
            >
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      className={`flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium py-2 ${
                        isLoggedIn && pathname === link.href ? 'bg-gray-100 px-3 rounded-full' : ''
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {Icon && <Icon className="w-4 h-4" />}
                      {link.name}
                    </Link>
                  );
                })}
                <div className="pt-4 border-t space-y-3">
                  {isLoggedIn ? (
                    <Button variant="outline" className="w-full" onClick={logout}>
                      Log Out
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full bg-[#E55A3C] hover:bg-[#D14A2E] text-white rounded-full"
                        onClick={() => { setShowSignIn(true); setMobileMenuOpen(false); }}
                      >
                        Sign In
                      </Button>
                      <Button
                        className="w-full bg-[#E55A3C] hover:bg-[#D14A2E] text-white rounded-full"
                        onClick={() => { setShowSignUp(true); setMobileMenuOpen(false); }}
                      >
                        Get Started
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      <SignUpModal open={showSignUp} onOpenChange={setShowSignUp} />
      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
        onLogin={handleLogin}
        onSignUpClick={handleSignUpClick}
      />
    </>
  );
}
