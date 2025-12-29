/**
 * CSV Export Utilities
 * Provides functions to export table data to CSV format (clipboard or file)
 */

/**
 * Convert table data to CSV string
 * @param headers - Array of column headers
 * @param rows - Array of row data (each row is array of values)
 * @returns CSV formatted string
 */
export function convertToCSV(headers: string[], rows: any[][]): string {
  // Escape CSV values (handle quotes and commas)
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert objects/arrays to JSON string
    const strValue = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }

    return strValue;
  };

  // Build CSV content
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(escapeCSVValue).join(','));

  // Add data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCSVValue).join(','));
  }

  return csvRows.join('\n');
}

/**
 * Copy CSV content to clipboard
 * @param csvContent - CSV formatted string
 * @returns Promise that resolves when copied
 */
export async function copyToClipboard(csvContent: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(csvContent);
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = csvContent;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Download CSV content as file using Wails SaveFileDialog
 * @param csvContent - CSV formatted string
 * @param filename - Default filename (without path)
 * @param saveFileFn - Wails SaveFile function
 * @returns Promise that resolves to the saved file path (or empty string if cancelled)
 */
export async function downloadCSV(
  csvContent: string,
  filename: string,
  saveFileFn: (filename: string, content: string) => Promise<string>
): Promise<string> {
  // Ensure filename has .csv extension
  if (!filename.endsWith('.csv')) {
    filename += '.csv';
  }

  try {
    const savedPath = await saveFileFn(filename, csvContent);
    return savedPath;
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}
