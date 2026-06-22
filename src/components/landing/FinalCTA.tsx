'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GradientBackground from './GradientBackground';
import SignUpModal from './SignUpModal';

export default function FinalCTA() {
  const [showSignUp, setShowSignUp] = useState(false);
  return (
    <GradientBackground variant="hero">
      <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-tight mb-8">
              Your ad strategy, unified.
            </h2>
            <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
              Stop fighting fragmented dashboards. Take control of every channel from one command center.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-[#E55A3C] hover:bg-white/90 rounded-full px-10 py-6 text-lg font-medium group"
                onClick={() => setShowSignUp(true)}
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 rounded-full px-10 py-6 text-lg font-medium bg-transparent"
              >
                Book a Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
      <SignUpModal open={showSignUp} onOpenChange={setShowSignUp} />
    </GradientBackground>
  );
}
