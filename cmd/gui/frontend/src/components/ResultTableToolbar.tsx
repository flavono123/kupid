import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Download, Clipboard, FileDown, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { convertToCSV, copyToClipboard, downloadCSV } from '@/lib/csv-export';
import { SaveFile } from '../../wailsjs/go/main/App';

interface ResultTableToolbarProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  filteredRowCount: number;
  totalRowCount: number;
  // Export data
  headers: string[];
  rows: any[][];
  resourceKind?: string; // For filename generation
}

export function ResultTableToolbar({
  globalFilter,
  onGlobalFilterChange,
  filteredRowCount,
  totalRowCount,
  headers,
  rows,
  resourceKind = 'resources',
}: ResultTableToolbarProps) {
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'copied' | 'downloaded' | 'error'>('idle');

  const handleExportToClipboard = async () => {
    try {
      setExporting(true);
      const csvContent = convertToCSV(headers, rows);
      await copyToClipboard(csvContent);
      setExportStatus('copied');
      setTimeout(() => setExportStatus('idle'), 1000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 1000);
    } finally {
      setExporting(false);
    }
  };

  const handleExportToFile = async () => {
    try {
      setExporting(true);
      const csvContent = convertToCSV(headers, rows);
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${resourceKind}-${timestamp}.csv`;

      const savedPath = await downloadCSV(csvContent, filename, SaveFile);

      if (savedPath) {
        // File was saved successfully
        console.log('File saved to:', savedPath);
        setExportStatus('downloaded');
      } else {
        // User cancelled
        setExportStatus('idle');
      }

      setTimeout(() => setExportStatus('idle'), 1000);
    } catch (error) {
      console.error('Failed to download file:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 1000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search all fields..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
          />
          {globalFilter && (
            <p className="text-xs text-muted-foreground mt-2">
              Found {filteredRowCount} / {totalRowCount} rows
            </p>
          )}
        </div>

        {/* Right: Export button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || rows.length === 0}
              className="gap-2"
            >
              {exportStatus === 'idle' && <Download className="h-4 w-4" />}
              {exportStatus === 'copied' && <Clipboard className="h-4 w-4 text-green-600" />}
              {exportStatus === 'downloaded' && <FileDown className="h-4 w-4 text-green-600" />}
              {exportStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}

              <span className={
                exportStatus === 'copied' || exportStatus === 'downloaded'
                  ? 'text-green-600'
                  : exportStatus === 'error'
                  ? 'text-red-600'
                  : ''
              }>
                {exportStatus === 'copied' && 'Copied'}
                {exportStatus === 'downloaded' && 'Downloaded'}
                {exportStatus === 'error' && 'Error'}
                {exportStatus === 'idle' && 'Export'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportToClipboard}>
              <Clipboard className="mr-2 h-4 w-4" />
              <span>Copy to Clipboard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportToFile}>
              <FileDown className="mr-2 h-4 w-4" />
              <span>Download as File</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
