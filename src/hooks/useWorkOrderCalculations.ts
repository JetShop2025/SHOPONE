/**
 * useWorkOrderCalculations Hook
 * Manages cost calculations for work orders
 */

import { useMemo, useCallback } from 'react';

interface CalculationInputs {
  totalHrs?: number;
  partsCost?: number;
  miscellaneousPercent?: number;
  weldPercent?: number;
  miscellaneousFixed?: number;
  weldFixed?: number;
  laborRate?: number;
}

interface CalculationResults {
  laborCost: number;
  miscAmount: number;
  weldAmount: number;
  subtotal: number;
  total: number;
}

/**
 * Custom hook for calculating work order costs
 * Handles labor, materials, and adjustments
 */
export const useWorkOrderCalculations = (inputs: CalculationInputs): CalculationResults => {
  const {
    totalHrs = 0,
    partsCost = 0,
    miscellaneousPercent = 0,
    weldPercent = 0,
    miscellaneousFixed = 0,
    weldFixed = 0,
    laborRate = 60
  } = inputs;

  return useMemo(() => {
    const hrs = Number(totalHrs) || 0;
    const parts = Math.max(0, Number(partsCost) || 0);
    const rate = Math.max(0, Number(laborRate) || 60);

    // Labor cost
    const laborCost = hrs * rate;

    // Subtotal before adjustments
    const subtotal = laborCost + parts;

    // Miscellaneous calculation (fixed or percentage)
    let miscAmount = 0;
    if (Number(miscellaneousFixed) > 0) {
      miscAmount = Number(miscellaneousFixed);
    } else if (Number(miscellaneousPercent) > 0) {
      miscAmount = subtotal * (Number(miscellaneousPercent) / 100);
    }

    // Weld calculation (fixed or percentage)
    let weldAmount = 0;
    if (Number(weldFixed) > 0) {
      weldAmount = Number(weldFixed);
    } else if (Number(weldPercent) > 0) {
      weldAmount = subtotal * (Number(weldPercent) / 100);
    }

    // Final total
    const total = subtotal + miscAmount + weldAmount;

    return {
      laborCost: parseFloat(laborCost.toFixed(2)),
      miscAmount: parseFloat(miscAmount.toFixed(2)),
      weldAmount: parseFloat(weldAmount.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }, [totalHrs, partsCost, miscellaneousPercent, weldPercent, miscellaneousFixed, weldFixed, laborRate]);
};

/**
 * Format calculation results for display
 * @param results - Calculation results from useWorkOrderCalculations
 * @returns Formatted strings with currency
 */
export const useFormattedCalculations = (results: CalculationResults) => {
  return useMemo(() => ({
    laborCost: `$${results.laborCost.toFixed(2)}`,
    miscAmount: `$${results.miscAmount.toFixed(2)}`,
    weldAmount: `$${results.weldAmount.toFixed(2)}`,
    subtotal: `$${results.subtotal.toFixed(2)}`,
    total: `$${results.total.toFixed(2)}`
  }), [results]);
};
