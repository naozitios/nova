'use client';

import Link from 'next/link';
import { Plus, Columns, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FilterState } from './campaign-table-types';

interface CampaignsToolbarProps {
  onColumnsClick: () => void;
  onExportClick: () => void;
  campaignCount: number;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const STATUS_OPTIONS = ['active', 'paused', 'draft', 'completed', 'failed'];
const PLATFORM_OPTIONS = ['meta', 'google'];

export function CampaignsToolbar({
  onColumnsClick,
  onExportClick,
  campaignCount,
  filters,
  onFiltersChange,
}: CampaignsToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search campaigns..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10 h-10 rounded-full bg-white border-stone-200"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 border-stone-200 ${
                filters.status.length > 0 ? 'bg-stone-900 text-white hover:bg-stone-800' : 'text-stone-600'
              }`}
            >
              Status
              {filters.status.length > 0 && (
                <span className="ml-1 bg-white/20 rounded-full px-1.5 text-xs">
                  {filters.status.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={filters.status.includes(status)}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    status: checked
                      ? [...filters.status, status]
                      : filters.status.filter((s) => s !== status),
                  });
                }}
                className="capitalize"
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 border-stone-200 ${
                filters.platform.length > 0 ? 'bg-stone-900 text-white hover:bg-stone-800' : 'text-stone-600'
              }`}
            >
              Platform
              {filters.platform.length > 0 && (
                <span className="ml-1 bg-white/20 rounded-full px-1.5 text-xs">
                  {filters.platform.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by platform</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PLATFORM_OPTIONS.map((platform) => (
              <DropdownMenuCheckboxItem
                key={platform}
                checked={filters.platform.includes(platform)}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    platform: checked
                      ? [...filters.platform, platform]
                      : filters.platform.filter((p) => p !== platform),
                  });
                }}
                className="capitalize"
              >
                {platform}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-stone-500 tabular-nums">
          {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onColumnsClick}
            className="gap-1.5 text-stone-600 border-stone-200"
          >
            <Columns className="w-4 h-4" />
            Columns
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExportClick}
            className="gap-1.5 text-stone-600 border-stone-200"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>

          <Link href="/campaigns/new">
            <Button
              size="sm"
              className="bg-[#E55A3C] hover:bg-[#D14A2E] gap-1.5 rounded-full"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
