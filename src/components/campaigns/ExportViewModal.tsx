'use client';

import { useState } from 'react';
import { Download, FileText, Table, FileSpreadsheet, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CampaignTableRow, ColumnDefinition } from './campaign-table-types';

interface ExportViewModalProps {
  rows: CampaignTableRow[];
  visibleColumns: ColumnDefinition[];
  onExport: (format: 'csv' | 'excel' | 'pdf') => void;
  onClose: () => void;
}

type ExportStatus = 'idle' | 'exporting' | 'success';

interface FormatOption {
  id: 'csv' | 'excel' | 'pdf';
  label: string;
  icon: typeof Table;
  enabled: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'csv', label: 'CSV', icon: Table, enabled: true },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, enabled: false },
  { id: 'pdf', label: 'PDF', icon: FileText, enabled: false },
];

export function ExportViewModal({
  rows,
  visibleColumns,
  onExport,
  onClose,
}: ExportViewModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [status, setStatus] = useState<ExportStatus>('idle');

  const rowCount = rows.length;
  const columnCount = visibleColumns.length;

  function handleExport() {
    const option = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
    if (!option?.enabled) return;

    setStatus('exporting');

    setTimeout(() => {
      onExport(selectedFormat);
      setStatus('success');
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={status === 'exporting' ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">Export Table Data</h2>
          <button
            onClick={onClose}
            disabled={status === 'exporting'}
            className="p-1 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {status === 'success' ? (
          /* Success state */
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-stone-900">Export complete</p>
              <p className="text-sm text-stone-500 mt-1">
                {rowCount} rows exported as {selectedFormat.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="border-stone-200 text-stone-600"
              >
                <Download className="w-3.5 h-3.5" />
                Download again
              </Button>
              <Button
                size="sm"
                onClick={onClose}
                className="bg-[#E55A3C] hover:bg-[#D14A2E] text-white"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Format selection */}
            <div className="px-6 pt-5 pb-3">
              <p className="text-sm font-medium text-stone-700 mb-3">Select format</p>
              <div className="grid grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map((format) => {
                  const isSelected = selectedFormat === format.id;
                  const Icon = format.icon;

                  return (
                    <button
                      key={format.id}
                      onClick={() => {
                        if (format.enabled) setSelectedFormat(format.id);
                      }}
                      disabled={!format.enabled}
                      className={`relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all ${
                        !format.enabled
                          ? 'opacity-50 cursor-not-allowed border-stone-100 bg-stone-50'
                          : isSelected
                            ? 'border-[#E55A3C] bg-[#FEF4F1]'
                            : 'border-stone-200 bg-white hover:border-[#E55A3C]/50'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isSelected ? 'text-[#E55A3C]' : 'text-stone-400'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isSelected ? 'text-[#E55A3C]' : 'text-stone-600'
                        }`}
                      >
                        {format.label}
                      </span>
                      {!format.enabled && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-stone-100 text-stone-400"
                        >
                          Coming soon
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="px-6 py-3">
              <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 rounded-xl px-4 py-2.5">
                <Table className="w-4 h-4 text-stone-400" />
                <span>
                  <span className="font-medium text-stone-700">{rowCount}</span> rows &times;{' '}
                  <span className="font-medium text-stone-700">{columnCount}</span> columns
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-stone-500"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={status === 'exporting'}
                className="bg-[#E55A3C] hover:bg-[#D14A2E] text-white"
              >
                {status === 'exporting' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
