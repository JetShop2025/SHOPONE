import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// authenticateUser is the public API used by the UI.  "login" was previously exported
// but components were importing a non‑existent symbol, which caused a compile error.
export const authenticateUser = async (username: string, password: string): Promise<any> => {
    try {
        const response = await axios.post<{ token?: string }>(`${API_URL}/login`, { username, password });
        if (response.data?.token) {
            localStorage.setItem('user', JSON.stringify(response.data));
        }
        return response.data;
    } catch (error) {
        // bubble up a generic message so we don't leak internal details
        throw new Error('Login failed. Please check your credentials.');
    }
};

export const logout = () => {
    localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
    const user = localStorage.getItem('user');
    return user !== null;
};