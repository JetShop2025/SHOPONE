import axios from 'axios';

const API_URL = '/api/inventory';

export const fetchInventoryItems = async (): Promise<any[]> => {
    try {
        const response = await axios.get<any[]>(API_URL);
        return response.data;
    } catch (error) {
        const msg = String(error);
        throw new Error('Error fetching inventory items: ' + msg);
    }
};
