/**
 * Work Order Formatters & Converters
 * Functions for formatting dates, amounts, and status values for display
 */

/**
 * Normalize a date from various formats to YYYY-MM-DD
 * @param raw - Date string in various formats (MM/DD/YYYY, ISO, etc)
 * @returns Normalized date string YYYY-MM-DD or empty string
 */
export const normalizeOrderDate = (raw: string | undefined): string => {
  if (!raw) return '';
  
  // Try ISO format (already normalized)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  
  // Try MM/DD/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [mm, dd, yyyy] = raw.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  return '';
};

/**
 * Get work order start date from multiple possible fields
 * @param order - Work order object
 * @returns Normalized start date string
 */
export const getOrderStartDate = (order: any): string => {
  return normalizeOrderDate(order?.startDate) || normalizeOrderDate(order?.date);
};

/**
 * Get work order end date
 * @param order - Work order object
 * @returns Normalized end date string
 */
export const getOrderEndDate = (order: any): string => {
  return normalizeOrderDate(order?.endDate);
};

/**
 * Format work order total for display
 * Handles string with $, number, or missing values
 * @param order - Work order object with totalLabAndParts field
 * @returns Formatted currency string (e.g., "$123.45")
 */
export const calcularTotalWO = (order: any): string => {
  // Check if it's a valid string with $
  if (
    typeof order.totalLabAndParts === 'string' &&
    order.totalLabAndParts.trim() &&
    order.totalLabAndParts.trim() !== '$NaN'
  ) {
    return order.totalLabAndParts.trim();
  }
  
  // Check if it's a valid number
  if (
    typeof order.totalLabAndParts === 'number' && 
    !isNaN(order.totalLabAndParts)
  ) {
    return `$${order.totalLabAndParts.toFixed(2)}`;
  }
  
  // Fallback to $0.00
  return '$0.00';
};

/**
 * Format amount as currency
 * @param value - Numeric value
 * @returns Currency formatted string
 */
export const formatCurrency = (value: any): string => {
  const num = Number(value) || 0;
  return `$${num.toFixed(2)}`;
};

/**
 * Format status for display with readable labels
 * @param status - Status value
 * @returns Readable status label
 */
export const formatStatus = (status: string | undefined): string => {
  const statusMap: { [key: string]: string } = {
    'PROCESSING': 'Processing',
    'APPROVED': 'Approved',
    'FINISHED': 'Finished',
    'TRANSFERRED': 'Transferred'
  };
  
  return statusMap[String(status || '').toUpperCase()] || 'Unknown';
};

/**
 * Get status badge color
 * @param status - Status value
 * @returns Color code for status badge
 */
export const getStatusColor = (status: string | undefined): string => {
  const colorMap: { [key: string]: string } = {
    'PROCESSING': '#FF9800',  // Orange
    'APPROVED': '#2196F3',    // Blue
    'FINISHED': '#4CAF50',    // Green
    'TRANSFERRED': '#9C27B0'  // Purple
  };
  
  return colorMap[String(status || '').toUpperCase()] || '#999999';
};

/**
 * Parse error message from API response
 * @param error - Axios error object
 * @returns User-friendly error message
 */
export const parseErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Unknown error occurred'
  );
};
