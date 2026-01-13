import { useRef } from "react";
import { motion } from 'framer-motion';
import { Upload, Sparkles, ShoppingBag, Share2 } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Photo',
    description: 'Take a clear photo or upload an existing one. Our AI works best with front-facing photos in good lighting.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Browse & Select',
    description: 'Explore thousands of clothing items from top brands. Click any item to see how it looks on you instantly.',
  },
  {
    number: '03',
    icon: ShoppingBag,
    title: 'Try It On',
    description: 'See realistic renders of clothing on your body. Adjust sizes, colors, and styles in real-time with AI precision.',
  },
  {
    number: '04',
    icon: Share2,
    title: 'Shop & Share',
    description: 'Love the look? Buy directly or save to your wishlist. Share your virtual try-ons with friends for feedback.',
  },
];

export default function Tutorial() {
  const tutorialRef = useRef<HTMLDivElement>(null);
  
  return (
    <section ref={tutorialRef} id="tutorial" className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-[#E55A3C] font-medium text-sm tracking-wider uppercase">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-light text-gray-900 mt-4 mb-6">
            Try on clothes in seconds
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            No fitting rooms, no returns. See exactly how any outfit looks on you before you buy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-[#E55A3C] font-mono text-sm mb-4">/{step.number}</span>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mb-6">
                  <step.icon className="w-8 h-8 text-[#E55A3C]" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}