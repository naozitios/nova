'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, BarChart3 } from 'lucide-react';

interface SignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SignUpModal({ open, onOpenChange }: SignUpModalProps) {
  const [formData, setFormData] = useState({ name: '', email: '', company: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    alert("Thank you! We'll be in touch soon.");
    setIsSubmitting(false);
    setFormData({ name: '', email: '', company: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E55A3C] to-[#F4A574] mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">Try Nova Free</DialogTitle>
          <DialogDescription className="text-center">
            No credit card required. Set up your first cross-channel campaign in minutes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name" placeholder="John Smith"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email" type="email" placeholder="john@agency.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company" placeholder="Your Agency or Brand"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#E55A3C] hover:bg-[#D14A2E] text-white h-11 rounded-lg font-medium group"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Start Free Trial'}
            {!isSubmitting && (
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </Button>
          <p className="text-xs text-gray-500 text-center mt-4">
            No credit card required. 14-day free trial.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
