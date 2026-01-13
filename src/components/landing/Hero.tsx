'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GradientBackground from './GradientBackground';
// import AnimatedNumber from './AnimatedNumber';
import SignUpModal from './SignUpModal';

export default function Hero() {
  const [showSignUp, setShowSignUp] = useState(false);
  // const stats = [
  //   { value: 847500, label: 'Hours saved from users' },
  //   { value: 12400, label: 'Dollars saved', prefix: '$', suffix: 'M+' },
  //   { value: 98.7, label: 'Happy customers', suffix: '%' },
  // ];

  return (
    <GradientBackground variant="hero">
      <div className="min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 py-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl"
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light text-white leading-[1.1] tracking-tight">
            Stop stressing over what
            <br />
            <span className="font-normal">you wear.</span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 text-xl md:text-2xl text-white/80 max-w-2xl font-light leading-relaxed"
          >
            Dress your best without thinking about it
          </motion.p>

          {/* Stats */}
          {/* <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 flex flex-wrap gap-8 md:gap-12"
          >
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center gap-4">
                <div>
                  <div className="text-3xl md:text-4xl font-semibold text-white">
                    <AnimatedNumber 
                      value={stat.value} 
                      prefix={stat.prefix || ''} 
                      suffix={stat.suffix || ''} 
                    />
                  </div>
                  <div className="text-sm text-white/60 mt-1">{stat.label}</div>
                </div>
                {index < stats.length - 1 && (
                  <div className="hidden md:block h-12 w-px bg-white/20 ml-4" />
                )}
              </div>
            ))}
          </motion.div> */}

          {/* CTA Buttons */}
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
              Get Started
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            {/* <Button 
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg font-medium bg-transparent"
            >
              Watch Demo
            </Button> */}
          </motion.div>
        </motion.div>
      </div>

      <SignUpModal open={showSignUp} onOpenChange={setShowSignUp} />
    </GradientBackground>
  );
}
