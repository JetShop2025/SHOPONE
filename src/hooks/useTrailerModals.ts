/**
 * useTrailerModals Hook
 * Centralized modal state management for TrailasTable
 * Prevents state collision and makes modals easier to manage
 */

import { useState, useCallback } from 'react';

interface TrailerModalState {
  rental: boolean;
  rentalData?: any;
  return: boolean;
  returnData?: any;
  available: boolean;
  availableData?: any;
  rentalHistory: boolean;
  rentalHistoryData?: any;
  workOrderHistory: boolean;
  workOrderHistoryData?: any;
}

export const useTrailerModals = () => {
  const [modals, setModals] = useState<TrailerModalState>({
    rental: false,
    return: false,
    available: false,
    rentalHistory: false,
    workOrderHistory: false
  });

  // Rental modal
  const openRentalModal = useCallback((trailerData?: any) => {
    setModals(prev => ({
      ...prev,
      rental: true,
      rentalData: trailerData
    }));
  }, []);

  const closeRentalModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      rental: false,
      rentalData: undefined
    }));
  }, []);

  // Return modal
  const openReturnModal = useCallback((trailerData?: any) => {
    setModals(prev => ({
      ...prev,
      return: true,
      returnData: trailerData
    }));
  }, []);

  const closeReturnModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      return: false,
      returnData: undefined
    }));
  }, []);

  // Available modal
  const openAvailableModal = useCallback((trailerData?: any) => {
    setModals(prev => ({
      ...prev,
      available: true,
      availableData: trailerData
    }));
  }, []);

  const closeAvailableModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      available: false,
      availableData: undefined
    }));
  }, []);

  // Rental history modal
  const openRentalHistoryModal = useCallback((trailerData?: any) => {
    setModals(prev => ({
      ...prev,
      rentalHistory: true,
      rentalHistoryData: trailerData
    }));
  }, []);

  const closeRentalHistoryModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      rentalHistory: false,
      rentalHistoryData: undefined
    }));
  }, []);

  // Work order history modal
  const openWorkOrderHistoryModal = useCallback((trailerData?: any) => {
    setModals(prev => ({
      ...prev,
      workOrderHistory: true,
      workOrderHistoryData: trailerData
    }));
  }, []);

  const closeWorkOrderHistoryModal = useCallback(() => {
    setModals(prev => ({
      ...prev,
      workOrderHistory: false,
      workOrderHistoryData: undefined
    }));
  }, []);

  // Close all modals at once
  const closeAllModals = useCallback(() => {
    setModals({
      rental: false,
      return: false,
      available: false,
      rentalHistory: false,
      workOrderHistory: false
    });
  }, []);

  return {
    modals,
    openRentalModal,
    closeRentalModal,
    openReturnModal,
    closeReturnModal,
    openAvailableModal,
    closeAvailableModal,
    openRentalHistoryModal,
    closeRentalHistoryModal,
    openWorkOrderHistoryModal,
    closeWorkOrderHistoryModal,
    closeAllModals
  };
};
