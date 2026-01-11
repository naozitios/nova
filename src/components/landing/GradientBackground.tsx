"use client";

import React from 'react';

interface GradientBackgroundProps {
  children: React.ReactNode;
  variant?: 'hero' | 'warm' | 'reverse' | 'subtle';
}

export default function GradientBackground({ children, variant = 'hero' }: GradientBackgroundProps) {
  const variants = {
    hero: 'bg-gradient-to-br from-[#E55A3C] via-[#F4A574] to-[#FEF3E2]',
    warm: 'bg-gradient-to-r from-[#FEF3E2] via-[#FFDAB9] to-[#F4A574]',
    reverse: 'bg-gradient-to-bl from-[#E55A3C] via-[#F4A574] to-[#FEF3E2]',
    subtle: 'bg-gradient-to-b from-[#FEF3E2] to-white',
  };

  return (
    <div className={`relative overflow-hidden ${variants[variant]}`}>
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}