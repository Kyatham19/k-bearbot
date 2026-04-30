import * as XLSX from 'xlsx';

export interface ExcelStockData {
  Company: string;
  'Open Price': number;
  'Close Price': number;
  'High': number;
  'Low': number;
  Trend: 'Bullish' | 'Bearish';
  'AI Insight': string;
}

export function generateExcelReport(
  stocksData: ExcelStockData[],
  reportTitle: string = 'Daily Stock Report'
): Buffer {
  // Create worksheet data
  const worksheetData = [
    [reportTitle],
    [], // Empty row
    ['Company', 'Open Price', 'Close Price', 'High', 'Low', 'Trend', 'AI Insight'],
    ...stocksData.map(stock => [
      stock.Company,
      stock['Open Price'],
      stock['Close Price'],
      stock.High,
      stock.Low,
      stock.Trend,
      stock['AI Insight']
    ])
  ];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet['!cols'] = [
    { width: 20 }, // Company
    { width: 12 }, // Open Price
    { width: 12 }, // Close Price
    { width: 12 }, // High
    { width: 12 }, // Low
    { width: 10 }, // Trend
    { width: 50 }, // AI Insight
  ];

  // Style the header row (row 3, 0-indexed as 2)
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col });
    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFE6E6FA' } } // Light lavender background
      };
    }
  }

  // Style the title row (row 1, 0-indexed as 0)
  const titleCell = 'A1';
  if (worksheet[titleCell]) {
    worksheet[titleCell].s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center' }
    };
  }

  // Merge title cells
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } } // Merge A1:G1 for title
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Report');

  // Generate buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function generateCsvReport(
  stocksData: ExcelStockData[],
  reportTitle: string = 'Daily Stock Report'
): string {
  const csvRows = [
    reportTitle,
    '', // Empty row
    'Company,Open Price,Close Price,High,Low,Trend,AI Insight',
    ...stocksData.map(stock =>
      `"${stock.Company}",${stock['Open Price']},${stock['Close Price']},${stock.High},${stock.Low},"${stock.Trend}","${stock['AI Insight']}"`
    )
  ];

  return csvRows.join('\n');
}