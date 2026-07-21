'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_BUSINESS_ALIAS } from '@/lib/demo-user';

export default function OnboardingIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/onboarding/${DEMO_BUSINESS_ALIAS}`);
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf6f4] text-sm text-[#645d58]">
      Redirecting to onboarding…
    </div>
  );
}
