'use client';

import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';
import type { RecentChangeItem as RecentChangeItemType } from './dashboard-types';

interface RecentChangeItemProps {
  item: RecentChangeItemType;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RecentChangeItem({ item }: RecentChangeItemProps) {
  const content = (
    <div className="flex items-center gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-4 transition hover:border-stone-200 hover:bg-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-stone-500 shadow-sm">
        <Clock3 className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">{item.description}</p>
        <p className="truncate text-sm text-stone-500">{item.campaignName}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm text-stone-400">
        <span>{formatTimestamp(item.timestamp)}</span>
        {item.href ? <ArrowRight className="h-4 w-4" /> : null}
      </div>
    </div>
  );

  if (!item.href) return content;

  return <Link href={item.href}>{content}</Link>;
}
