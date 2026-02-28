import { User } from '../models/User';

const users: User[] = [];

export const createUser = (user: User): User => {
    users.push(user);
    return user;
};

export const getUserById = (id: string): User | undefined => {
    return users.find(user => user.id === id);
};

export const updateUser = (id: string, updatedUser: Partial<User>): User | undefined => {
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updatedUser };
        return users[userIndex];
    }
    return undefined;
};

export const deleteUser = (id: string): boolean => {
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
        users.splice(userIndex, 1);
        return true;
    }
    return false;
};