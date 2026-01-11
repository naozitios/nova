"use client";

import React from 'react';
import { motion } from 'framer-motion';

const integrations = [
  { name: 'Shopify', color: '#7AB55C' },
  { name: 'HubSpot', color: '#FF7A59' },
  { name: 'Outreach', color: '#5951FF' },
  { name: 'Apollo', color: '#6B5CE7' },
  { name: 'LinkedIn', color: '#0A66C2' },
  { name: 'Slack', color: '#4A154B' },
  { name: 'Gmail', color: '#EA4335' },
  { name: 'Calendly', color: '#006BFF' },
  { name: 'Zoom', color: '#2D8CFF' },
  { name: 'Gong', color: '#7B61FF' },
];

export default function Integrations() {
  return (
    <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-gradient-to-b from-white to-[#FEF3E2]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-4">
            Connects seamlessly with your existing stack
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Native integrations with the tools your team already uses
          </p>
        </motion.div>

        {/* Integration logos grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-6"
        >
          {integrations.map((integration, index) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white rounded-2xl p-6 flex items-center justify-center shadow-sm hover:shadow-lg transition-shadow duration-300 group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: integration.color }}
                >
                  {integration.name[0]}
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                  {integration.name}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Custom integrations badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600">+ Custom API Integrations Available</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}