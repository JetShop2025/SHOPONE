import axios from 'axios';

const API_URL = '/api/workorders';

export const fetchWorkOrders = async (): Promise<any[]> => {
    try {
        const response = await axios.get<any[]>(API_URL);
        return response.data;
    } catch (error) {
        const msg = String(error);
        throw new Error('Error fetching work orders: ' + msg);
    }
};

export const createWorkOrder = async (workOrderData: any): Promise<any> => {
    try {
        const response = await axios.post<any>(API_URL, workOrderData);
        return response.data;
    } catch (error) {
        const msg = String(error);
        throw new Error('Error creating work order: ' + msg);
    }
};

export const updateWorkOrder = async (
    id: string | number,
    workOrderData: any
): Promise<any> => {
    try {
        const response = await axios.put<any>(`${API_URL}/${id}`, workOrderData);
        return response.data;
    } catch (error) {
        const msg = String(error);
        throw new Error('Error updating work order: ' + msg);
    }
};

export const deleteWorkOrder = async (id: string | number): Promise<void> => {
    try {
        await axios.delete(`${API_URL}/${id}`);
    } catch (error) {
        const msg = String(error);
        throw new Error('Error deleting work order: ' + msg);
    }
};