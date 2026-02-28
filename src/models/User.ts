export interface User {
    id: string;
    username: string;
    password?: string; // optional when returning user data
    // add other fields as needed (email, role, etc.)
}
