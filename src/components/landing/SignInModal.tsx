"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Sparkles } from 'lucide-react';

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string) => void;
  onSignUpClick: () => void;
}

export default function SignInModal({ open, onOpenChange, onLogin, onSignUpClick }: SignInModalProps) {
  const [formData, setFormData] = useState({ email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (formData.email !== 'nova@gmail.com') {
      setError('No account existing with this email. Please sign up.');
      setIsSubmitting(false);
      return;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Form submitted:', formData);
    onLogin(formData.email);
    
    setIsSubmitting(false);
    setFormData({ email: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E55A3C] to-[#F4A574] mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">Welcome back to Nova</DialogTitle>
          <DialogDescription className="text-center">
            Glad to have you back!
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="h-11"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-[#E55A3C] hover:bg-[#D14A2E] text-white h-11 rounded-lg font-medium group"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
            {!isSubmitting && (
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </Button>
        </form>
        <p className="text-xs text-gray-500 text-center mt-4">
          No account?
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onSignUpClick();
              }}
              className="text-[#E55A3C] hover:text-[#D14A2E] font-medium hover:underline ml-1"
            >
              Sign up here
            </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}