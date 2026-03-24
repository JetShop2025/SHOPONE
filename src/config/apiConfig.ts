/**
 * API Configuration
 * Single source of truth for API endpoints and configuration
 * Used across all service layers and components
 */

export const API_URL = process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api';

/**
 * Standard timeout values for API requests
 */
export const API_TIMEOUTS = {
  default: 10000,      // 10 seconds - standard requests
  long: 15000,         // 15 seconds - heavy operations
  short: 5000,         // 5 seconds - quick checks
  veryLong: 30000      // 30 seconds - batch operations
};

/**
 * API endpoints mapping (for easy reference and maintenance)
 */
export const ENDPOINTS = {
  workOrders: '/work-orders',
  workOrderParts: '/work-order-parts',
  inventory: '/inventory',
  receives: '/receives',
  trailers: '/trailers',
  trailerLocation: '/trailer-location',
  login: '/login',
  audit: '/audit',
  reports: '/reports'
};

/**
 * Get full API URL for an endpoint
 * @param endpoint - The endpoint key from ENDPOINTS
 * @returns Full API URL
 */
export function getEndpointUrl(endpoint: string): string {
  const path = ENDPOINTS[endpoint as keyof typeof ENDPOINTS];
  if (!path) {
    console.warn(`Unknown endpoint: ${endpoint}`);
    return `${API_URL}${endpoint}`;
  }
  return `${API_URL}${path}`;
}
