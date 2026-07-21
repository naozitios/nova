'use client';

import type { BusinessBasics } from '@/lib/onboarding/types';
import { OnboardingCard } from './OnboardingCard';

type BusinessBasicsFormProps = {
  value: BusinessBasics;
  onChange: (update: Partial<BusinessBasics>) => void;
};

export function BusinessBasicsForm({ value, onChange }: BusinessBasicsFormProps) {
  return (
    <div className="grid gap-6">
      <OnboardingCard>
        <div className="mb-6 border-b border-border pb-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Workspace Integration</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure your business profile to allow NOVA to tailor audience segments and performance benchmarks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Business Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="business-name">
              Business name
            </label>
            <input
              id="business-name"
              type="text"
              value={value.businessName}
              onChange={(e) => onChange({ businessName: e.target.value })}
              placeholder="e.g. Acme Corp"
              className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
            />
          </div>

          {/* Website URL */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="website-url">
              Website URL
            </label>
            <input
              id="website-url"
              type="url"
              value={value.websiteUrl}
              onChange={(e) => onChange({ websiteUrl: e.target.value })}
              placeholder="https://example.com"
              className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
            />
          </div>

          {/* Primary Market */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="primary-market">
              Primary market
            </label>
            <select
              id="primary-market"
              value={value.primaryMarket}
              onChange={(e) => onChange({ primaryMarket: e.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-foreground transition-all focus:border-primary focus:ring-primary"
            >
              <option value="" disabled>
                Select market
              </option>
              <option value="us">United States</option>
              <option value="eu">European Union</option>
              <option value="apac">Asia Pacific</option>
              <option value="latam">Latin America</option>
            </select>
          </div>

          {/* Business Type */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="business-type">
              Business type
            </label>
            <select
              id="business-type"
              value={value.businessType}
              onChange={(e) => onChange({ businessType: e.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-foreground transition-all focus:border-primary focus:ring-primary"
            >
              <option value="" disabled>
                Select type
              </option>
              <option value="ecommerce">E-commerce</option>
              <option value="saas">SaaS</option>
              <option value="leadgen">Lead Generation</option>
              <option value="local">Local Service</option>
            </select>
          </div>

          {/* Main Advertising Goal (Full Width) */}
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="advertising-goal">
              Main advertising goal
            </label>
            <select
              id="advertising-goal"
              value={value.advertisingGoal}
              onChange={(e) => onChange({ advertisingGoal: e.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-white px-4 text-sm text-foreground transition-all focus:border-primary focus:ring-primary"
            >
              <option value="" disabled>
                What is your primary objective?
              </option>
              <option value="sales">Drive Sales & Revenue</option>
              <option value="leads">Generate Qualified Leads</option>
              <option value="brand">Increase Brand Awareness</option>
              <option value="traffic">Maximize Site Traffic</option>
            </select>
          </div>
        </div>
      </OnboardingCard>
    </div>
  );
}
