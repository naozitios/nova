'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GradientBackground from './GradientBackground';
import SignUpModal from './SignUpModal';

export default function Hero() {
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <GradientBackground variant="hero">
      <div className="min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 py-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-sm font-medium mb-8">
            <BarChart3 className="w-4 h-4" />
            Nova — Cross-Channel Ad Command Center
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light text-white leading-[1.1] tracking-tight">
            Launch, analyze & optimize
            <br />
            <span className="font-normal">across Meta & Google.</span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 text-xl md:text-2xl text-white/80 max-w-2xl font-light leading-relaxed"
          >
            One dashboard to manage campaigns, unify analytics, and automate budget allocation across every major ad network.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 flex flex-wrap gap-4"
          >
            <Button
              size="lg"
              className="bg-white text-[#E55A3C] hover:bg-white/90 rounded-full px-8 py-6 text-lg font-medium group"
              onClick={() => setShowSignUp(true)}
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg font-medium bg-transparent"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See Features
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <SignUpModal open={showSignUp} onOpenChange={setShowSignUp} />
    </GradientBackground>
  );
}
