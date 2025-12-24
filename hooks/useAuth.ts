
import { useState, useEffect, useCallback } from 'react';
import type { User, Role, Permission } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { sampleRoles, sampleUsers } from '../data/sampleData';

export function useAuth() {
    // We use localStorage to persist "users" and "roles" data to simulate a database
    const [users, setUsers] = useLocalStorage<User[]>('users-v2', sampleUsers);
    const [roles, setRoles] = useLocalStorage<Role[]>('roles-v2', sampleRoles);
    
    // We use sessionStorage for the current session (refresh page keeps login)
    const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('currentUserId');
        }
        return null;
    });

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentRole, setCurrentRole] = useState<Role | null>(null);

    useEffect(() => {
        if (currentUserId) {
            const user = users.find(u => u.id === currentUserId);
            if (user) {
                setCurrentUser(user);
                const role = roles.find(r => r.id === user.roleId);
                setCurrentRole(role || null);
                sessionStorage.setItem('currentUserId', user.id);
            } else {
                logout();
            }
        } else {
            setCurrentUser(null);
            setCurrentRole(null);
            sessionStorage.removeItem('currentUserId');
        }
    }, [currentUserId, users, roles]);

    const login = useCallback((email: string, password: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            // Simulation delay
            setTimeout(() => {
                const user = users.find(u => u.email === email && u.password === password && u.status === 'active');
                if (user) {
                    setCurrentUserId(user.id);
                    resolve();
                } else {
                    reject('Email hoặc mật khẩu không đúng.');
                }
            }, 800);
        });
    }, [users]);

    const logout = useCallback(() => {
        setCurrentUserId(null);
        sessionStorage.removeItem('currentUserId');
    }, []);

    const hasPermission = useCallback((permission: Permission): boolean => {
        if (!currentRole) return false;
        return currentRole.permissions.includes(permission);
    }, [currentRole]);
    
    const updateProfile = (updatedUser: Partial<User>) => {
        if(!currentUser) return;
        
        const newUser = { ...currentUser, ...updatedUser };
        
        setUsers(prev => prev.map(u => u.id === currentUser.id ? newUser : u));
        // currentUser state will update automatically via useEffect
    }

    return {
        currentUser,
        currentRole,
        login,
        logout,
        hasPermission,
        users,
        setUsers,
        roles,
        setRoles,
        updateProfile
    };
}
