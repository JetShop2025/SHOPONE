/**
 * Trailer Helper Functions
 * Utilities for working with trailers and rental operations
 */

/**
 * Calculate rental days between two dates
 * @param startDate - Rental start date (YYYY-MM-DD)
 * @param endDate - Rental end date (YYYY-MM-DD)
 * @returns Number of days
 */
export const calculateRentalDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = Math.abs(end.getTime() - start.getTime());
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return daysDiff || 1; // Minimum 1 day
};

/**
 * Calculate rental cost
 * @param dailyRate - Daily rental rate
 * @param days - Number of days
 * @param discountPercent - Discount percentage (0-100)
 * @returns Total rental cost
 */
export const calculateRentalCost = (
  dailyRate: number,
  days: number,
  discountPercent: number = 0
): number => {
  const rate = Number(dailyRate) || 0;
  const numDays = Number(days) || 0;
  const discount = Math.min(Number(discountPercent) || 0, 100);
  
  const subtotal = rate * numDays;
  const discountAmount = subtotal * (discount / 100);
  
  return subtotal - discountAmount;
};

/**
 * Get trailer status label
 * @param status - Status value
 * @returns Readable status label
 */
export const getTrailerStatusLabel = (status: string | undefined): string => {
  const statusMap: { [key: string]: string } = {
    'AVAILABLE': 'Available',
    'RENTED': 'Rented',
    'MAINTENANCE': 'Maintenance',
    'TRANSFERRED': 'Transferred',
    'ARCHIVED': 'Archived'
  };
  
  return statusMap[String(status || '').toUpperCase()] || 'Unknown';
};

/**
 * Get trailer status color for UI
 * @param status - Status value
 * @returns Color code
 */
export const getTrailerStatusColor = (status: string | undefined): string => {
  const colorMap: { [key: string]: string } = {
    'AVAILABLE': '#4CAF50',   // Green
    'RENTED': '#FF9800',      // Orange
    'MAINTENANCE': '#F44336', // Red
    'TRANSFERRED': '#2196F3', // Blue
    'ARCHIVED': '#999999'     // Gray
  };
  
  return colorMap[String(status || '').toUpperCase()] || '#999999';
};

/**
 * Format trailer identification string
 * @param trailerCode - Trailer code (e.g., "1-100", "2-001")
 * @return Formatted identifier
 */
export const formatTrailerCode = (trailerCode: string | undefined): string => {
  if (!trailerCode) return 'N/A';
  return String(trailerCode).toUpperCase().trim();
};

/**
 * Validate trailer code format
 * @param code - Trailer code to validate
 * @returns True if valid format
 */
export const isValidTrailerCode = (code: string): boolean => {
  // Trailers typically follow pattern "X-###" or "X-### TRK"
  return /^\d+-\d+([^\s]*)$/.test(code);
};

/**
 * Filter trailers by status
 * @param trailers - Array of trailer objects
 * @param status - Status to filter by
 * @returns Filtered array
 */
export const filterTrailersByStatus = (trailers: any[], status: string): any[] => {
  return trailers.filter((t: any) =>
    String(t.estatus || '').toUpperCase() === String(status).toUpperCase()
  );
};

/**
 * Sort trailers by code
 * @param trailers - Array of trailers
 * @param ascending - Sort direction
 * @returns Sorted array
 */
export const sortTrailersByCode = (trailers: any[], ascending: boolean = true): any[] => {
  return [...trailers].sort((a, b) => {
    const codeA = String(a.nombre || '').trim();
    const codeB = String(b.nombre || '').trim();
    
    if (ascending) {
      return codeA.localeCompare(codeB);
    } else {
      return codeB.localeCompare(codeA);
    }
  });
};
