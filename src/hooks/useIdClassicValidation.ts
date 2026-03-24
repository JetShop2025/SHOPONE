/**
 * useIdClassicValidation Hook
 * Manages ID Classic validation logic for work orders
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/apiConfig';

export const useIdClassicValidation = () => {
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Validate that an ID Classic is unique (not used in FINISHED W.O)
   * @param idClassic - ID Classic value to validate
   * @param excludeWorkOrderId - Work order ID to exclude from check (for updates)
   * @returns True if valid, false if duplicate/invalid
   */
  const validateIdClassic = useCallback(
    async (idClassic: string, excludeWorkOrderId?: number): Promise<boolean> => {
      if (!idClassic || idClassic.trim() === '') {
        setValidationError('ID Classic is required');
        return false;
      }

      setIsValidating(true);
      setValidationError('');

      try {
        const response = await axios.post(
          `${API_URL}/validate-id-classic`,
          {
            idClassic: idClassic.trim(),
            excludeId: excludeWorkOrderId
          },
          { timeout: 5000 }
        );

        if (!response.data.isValid) {
          setValidationError(response.data.message || 'ID Classic already exists');
          return false;
        }

        return true;
      } catch (error: any) {
        // If endpoint doesn't exist, just allow it (backward compatibility)
        console.warn('ID Classic validation unavailable:', error.message);
        return true;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setValidationError('');
  }, []);

  return {
    validateIdClassic,
    validationError,
    isValidating,
    clearError
  };
};
