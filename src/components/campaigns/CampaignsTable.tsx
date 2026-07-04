'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { getColumnById } from './campaign-column-registry';
import { formatCurrency, formatStatus } from './campaign-table-utils';
import type { CampaignTableRow, ColumnDefinition } from './campaign-table-types';

interface CampaignsTableProps {
  rows: CampaignTableRow[];
  columns: ColumnDefinition[];
  visibleColumnIds: string[];
  isLoading: boolean;
  hasActiveFilters: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

const PLATFORM_INDICATOR: Record<string, { label: string; className: string }> = {
  meta: { label: 'M', className: 'bg-blue-100 text-blue-700' },
  google: { label: 'G', className: 'bg-red-100 text-red-700' },
};

function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <TableRow className="pointer-events-none">
      {Array.from({ length: columnCount }).map((_, i) => (
        <TableCell key={i} className="py-2.5">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={100} className="h-48 text-center">
        <div className="flex flex-col items-center gap-2 text-stone-500">
          <p className="text-sm font-medium">No campaigns</p>
          <p className="text-xs text-stone-400">
            Create your first campaign to get started.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function NoFilterMatches() {
  return (
    <TableRow>
      <TableCell colSpan={100} className="h-48 text-center">
        <div className="flex flex-col items-center gap-2 text-stone-500">
          <p className="text-sm font-medium">No campaigns match current filters</p>
          <p className="text-xs text-stone-400">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600 border-stone-200';
  return (
    <Badge
      variant="outline"
      className={`${colorClass} capitalize text-xs px-2 py-0 font-medium`}
    >
      {formatStatus(status)}
    </Badge>
  );
}

function PlatformIndicator({ platform }: { platform: string }) {
  const config = PLATFORM_INDICATOR[platform];
  if (!config) return <span className="text-xs text-stone-500">{platform}</span>;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function CampaignsTable({
  rows,
  columns,
  visibleColumnIds,
  isLoading,
  hasActiveFilters,
}: CampaignsTableProps) {
  const router = useRouter();

  const resolvedColumns = visibleColumnIds
    .map((id) => getColumnById(id) ?? columns.find((c) => c.id === id))
    .filter((col): col is ColumnDefinition => col != null);

  const handleRowClick = (e: React.MouseEvent, campaignId: string) => {
    if (
      e.defaultPrevented ||
      (e.target as HTMLElement).closest('a, button, [role="button"]')
    ) {
      return;
    }
    router.push(`/campaigns/${campaignId}`);
  };

  const columnCount = resolvedColumns.length || 1;

  return (
    <div className="w-full overflow-auto rounded-lg border border-stone-200 bg-white">
      <Table className="table-fixed">
        <TableHeader className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200">
          <TableRow className="hover:bg-stone-50">
            {resolvedColumns.map((col) => (
              <TableHead
                key={col.id}
                className="text-xs font-semibold text-stone-500 uppercase tracking-wider h-9 px-3 py-2"
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columnCount={columnCount} />
            ))
          ) : rows.length === 0 ? (
            hasActiveFilters ? <NoFilterMatches /> : <EmptyState />
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer group py-1"
                onClick={(e) => handleRowClick(e, row.id)}
              >
                {resolvedColumns.map((col) => (
                  <TableCell key={col.id} className="py-2 px-3 text-sm">
                    {col.id === 'status' ? (
                      <StatusBadge status={row.status} />
                    ) : col.id === 'objective' ? (
                      <span className="text-stone-600 text-xs">{row.objective}</span>
                    ) : col.id === 'budget' ? (
                      <span className="tabular-nums text-xs">
                        {formatCurrency(row.budget)}
                      </span>
                    ) : col.id === 'campaign' ? (
                      <div className="flex items-center gap-2.5">
                        <PlatformIndicator platform={row.platform} />
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900 truncate text-xs group-hover:text-[#E55A3C] transition-colors">
                            {row.name}
                          </p>
                        </div>
                      </div>
                    ) : col.formatter ? (
                      <span className="text-stone-600 text-xs">{col.formatter(row)}</span>
                    ) : (
                      <span className="text-stone-400 text-xs">—</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
