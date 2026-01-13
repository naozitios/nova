import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const testimonials = [
  {
    quote: 'Nova has revolutionized how our customers shop online. The virtual try-on feature has led to a significant increase in conversion rates and a noticeable reduction in returns.',
    author: "Sarah Johnson",
    title: "CEO of a popular fashion brand",
    company: "Fashion Forward",
  },
  {
    quote: 'The integration was seamless, and the support from the Nova team has been outstanding. Our customers love the virtual try-on, and we\'ve seen a huge boost in engagement.',
    author: "Michael Chen",
    title: "Head of E-commerce",
    company: "StyleSphere",
  },
];

export default function Testimonial() {
  return (
    <section className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-light text-gray-900 mb-4">
            Loved by fashion brands
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            See what our customers are saying about our virtual try-on tool.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-gradient-to-r from-gray-50 to-white rounded-3xl p-8 border border-gray-100"
            >
              <p className="text-lg text-gray-700 mb-6">{testimonial.quote}</p>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Image
                    className="h-12 w-12 rounded-full"
                    src={`https://i.pravatar.cc/150?u=${testimonial.author}`}
                    alt={testimonial.author}
                    width={48}
                    height={48}
                  />
                </div>
                <div className="ml-4">
                  <div className="text-base font-medium text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-500">{testimonial.title}, {testimonial.company}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
