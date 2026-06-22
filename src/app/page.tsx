'use client';

import React from 'react';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import Tutorial from '@/components/landing/Tutorial';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <div>
      <Hero />
      <Features />
      <Tutorial />
      <FinalCTA />
      <Footer />
    </div>
  );
}
