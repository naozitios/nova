'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterState } from './campaign-table-types';

interface CampaignFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const STATUS_OPTIONS = ['Active', 'Paused', 'Draft', 'Completed', 'Failed'] as const;
const PLATFORM_OPTIONS = ['Meta', 'Google'] as const;
const COUNTRY_OPTIONS = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'Brazil',
  'India',
  'Mexico',
  'Italy',
  'Spain',
  'Netherlands',
  'Sweden',
  'Singapore',
] as const;

function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search !== '' ||
    filters.status.length > 0 ||
    filters.objective.length > 0 ||
    filters.platform.length > 0 ||
    filters.dateRange !== null ||
    filters.country.length > 0
  );
}

export function CampaignFilters({ filters, onFiltersChange }: CampaignFiltersProps) {
  const activeFilterCount =
    filters.status.length +
    filters.objective.length +
    filters.platform.length +
    filters.country.length +
    (filters.dateRange ? 1 : 0);

  function handleStatusToggle(status: string) {
    onFiltersChange({
      ...filters,
      status: filters.status.includes(status)
        ? filters.status.filter((s) => s !== status)
        : [...filters.status, status],
    });
  }

  function handlePlatformToggle(platform: string) {
    onFiltersChange({
      ...filters,
      platform: filters.platform.includes(platform)
        ? filters.platform.filter((p) => p !== platform)
        : [...filters.platform, platform],
    });
  }

  function handleCountryToggle(country: string) {
    onFiltersChange({
      ...filters,
      country: filters.country.includes(country)
        ? filters.country.filter((c) => c !== country)
        : [...filters.country, country],
    });
  }

  function handleDateChange(field: 'start' | 'end', value: string) {
    const currentRange = filters.dateRange ?? { start: '', end: '' };
    const updatedRange = { ...currentRange, [field]: value };
    onFiltersChange({
      ...filters,
      dateRange: updatedRange.start === '' && updatedRange.end === '' ? null : updatedRange,
    });
  }

  function handleRemoveFilter(type: string, value?: string) {
    switch (type) {
      case 'status':
        onFiltersChange({
          ...filters,
          status: filters.status.filter((s) => s !== value),
        });
        break;
      case 'objective':
        onFiltersChange({
          ...filters,
          objective: filters.objective.filter((o) => o !== value),
        });
        break;
      case 'platform':
        onFiltersChange({
          ...filters,
          platform: filters.platform.filter((p) => p !== value),
        });
        break;
      case 'country':
        onFiltersChange({
          ...filters,
          country: filters.country.filter((c) => c !== value),
        });
        break;
      case 'dateRange':
        onFiltersChange({
          ...filters,
          dateRange: null,
        });
        break;
    }
  }

  function handleClearAll() {
    onFiltersChange({
      search: '',
      status: [],
      objective: [],
      platform: [],
      dateRange: null,
      country: [],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                Status
                {filters.status.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {filters.status.length}
                  </Badge>
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
                  onCheckedChange={() => handleStatusToggle(status)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                Objective
                {filters.objective.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {filters.objective.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by objective</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filters.objective.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No objectives available
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                Platform
                {filters.platform.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {filters.platform.length}
                  </Badge>
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
                  onCheckedChange={() => handlePlatformToggle(platform)}
                >
                  {platform}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.dateRange?.start ?? ''}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="h-9 w-full sm:w-36"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={filters.dateRange?.end ?? ''}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="h-9 w-full sm:w-36"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                Country
                {filters.country.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {filters.country.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Filter by country</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COUNTRY_OPTIONS.map((country) => (
                <DropdownMenuCheckboxItem
                  key={country}
                  checked={filters.country.includes(country)}
                  onCheckedChange={() => handleCountryToggle(country)}
                >
                  {country}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasActiveFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
            Clear all
          </Button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.status.map((status) => (
            <Badge key={`status-${status}`} variant="secondary" className="gap-1 pl-2">
              Status: {status}
              <button
                onClick={() => handleRemoveFilter('status', status)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {filters.platform.map((platform) => (
            <Badge key={`platform-${platform}`} variant="secondary" className="gap-1 pl-2">
              Platform: {platform}
              <button
                onClick={() => handleRemoveFilter('platform', platform)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {filters.objective.map((objective) => (
            <Badge key={`objective-${objective}`} variant="secondary" className="gap-1 pl-2">
              Objective: {objective}
              <button
                onClick={() => handleRemoveFilter('objective', objective)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {filters.country.map((country) => (
            <Badge key={`country-${country}`} variant="secondary" className="gap-1 pl-2">
              Country: {country}
              <button
                onClick={() => handleRemoveFilter('country', country)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {filters.dateRange && (
            <Badge variant="secondary" className="gap-1 pl-2">
              Date: {filters.dateRange.start || '...'} – {filters.dateRange.end || '...'}
              <button
                onClick={() => handleRemoveFilter('dateRange')}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
