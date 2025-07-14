import { useState } from 'react';

export interface WorkOrder {
  billToCo: string;
  trailer: string;
  mechanic: string;
  date: string;
  description: string;
  parts: { part: string; sku: string; qty: string; cost: string }[];
  totalHrs: string;
  totalLabAndParts: string;
  status: string;
  idClassic?: string;
  mechanics?: any[];
  extraOptions?: string[];
}

const EMPTY_WORK_ORDER: WorkOrder = {
  billToCo: '',
  trailer: '',
  mechanic: '',
  date: '',
  description: '',
  parts: [
    { part: '', sku: '', qty: '', cost: '' },
    { part: '', sku: '', qty: '', cost: '' },
    { part: '', sku: '', qty: '', cost: '' },
    { part: '', sku: '', qty: '', cost: '' },
    { part: '', sku: '', qty: '', cost: '' },
  ],  totalHrs: '',
  totalLabAndParts: '',
  status: '',
  idClassic: '',
};

export function useNewWorkOrder(): [
  WorkOrder,
  React.Dispatch<React.SetStateAction<WorkOrder>>,
  () => void
] {
  const [newWorkOrder, setNewWorkOrder] = useState<WorkOrder>({ ...EMPTY_WORK_ORDER });

  const resetNewWorkOrder = () => {
    // Crear una nueva instancia completamente limpia con partes vacías
    const cleanWorkOrder: WorkOrder = {
      billToCo: '',
      trailer: '',
      mechanic: '',
      date: '',
      description: '',
      parts: [
        { part: '', sku: '', qty: '', cost: '' },
        { part: '', sku: '', qty: '', cost: '' },
        { part: '', sku: '', qty: '', cost: '' },
        { part: '', sku: '', qty: '', cost: '' },
        { part: '', sku: '', qty: '', cost: '' },
      ],
      totalHrs: '',
      totalLabAndParts: '',
      status: '',
      idClassic: '',
      mechanics: [],
      extraOptions: []
    };
    setNewWorkOrder(cleanWorkOrder);
  };

  return [newWorkOrder, setNewWorkOrder, resetNewWorkOrder];
}