'use client';

import type { RecentChangeItem as RecentChangeItemType } from './dashboard-types';
import { RecentChangeItem } from './RecentChangeItem';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentChangesListProps {
  items: RecentChangeItemType[];
  isLoading: boolean;
  isError: boolean;
}

export function RecentChangesList({ items, isLoading, isError }: RecentChangesListProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-5 h-6 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-3xl border border-red-100 bg-white p-6 text-sm font-medium text-red-600 shadow-sm">
        Failed to load dashboard data
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900">Recent Changes</h2>
        <p className="mt-1 text-sm text-stone-500">Only campaign timestamps already present in frontend data are shown.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm font-medium text-stone-500">
          No recent changes for this period.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecentChangeItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
