// hooks/useSupabaseAuth.ts
// Supabase Auth integration with roles/permissions

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Role, Permission } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { sampleRoles, sampleUsers } from '../data/sampleData';

interface AuthState {
    user: User | null;
    role: Role | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

export function useSupabaseAuth() {
    // Check if Supabase is configured
    const useSupabase = isSupabaseConfigured();

    // Fallback to localStorage if Supabase not configured
    const [localUsers, setLocalUsers] = useLocalStorage<User[]>('users-v2', sampleUsers);
    const [localRoles, setLocalRoles] = useLocalStorage<Role[]>('roles-v2', sampleRoles);

    // Auth state
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        role: null,
        isLoading: true,
        isAuthenticated: false,
    });

    // Users and Roles lists (for admin management)
    const [users, setUsersState] = useState<User[]>([]);
    const [roles, setRolesState] = useState<Role[]>([]);

    // Initialize auth state
    useEffect(() => {
        if (!useSupabase) {
            // Fallback to localStorage
            const storedUserId = sessionStorage.getItem('currentUserId');
            if (storedUserId) {
                const user = localUsers.find(u => u.id === storedUserId);
                if (user) {
                    const role = localRoles.find(r => r.id === user.roleId);
                    setAuthState({
                        user,
                        role: role || null,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                } else {
                    setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
                }
            } else {
                setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
            }
            setUsersState(localUsers);
            setRolesState(localRoles);
            return;
        }

        // Supabase auth listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                // Fetch user profile from users table
                const { data: userProfile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', session.user.id)
                    .single();

                if (userProfile) {
                    // Fetch role
                    const { data: roleData } = await supabase
                        .from('roles')
                        .select('*')
                        .eq('id', userProfile.role_id)
                        .single();

                    const user: User = {
                        id: userProfile.id,
                        email: userProfile.email,
                        name: userProfile.name,
                        password: '', // Not stored in Supabase Auth
                        avatar: userProfile.avatar,
                        roleId: userProfile.role_id,
                        status: userProfile.status,
                    };

                    const role: Role | null = roleData ? {
                        id: roleData.id,
                        name: roleData.name,
                        permissions: roleData.permissions || [],
                    } : null;

                    setAuthState({
                        user,
                        role,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                } else {
                    setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
                }
            } else {
                setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
            }
        });

        // Fetch all users and roles for admin
        fetchUsersAndRoles();

        return () => subscription.unsubscribe();
    }, [useSupabase, localUsers, localRoles]);

    // Fetch users and roles from Supabase
    const fetchUsersAndRoles = async () => {
        if (!useSupabase) return;

        const { data: usersData } = await supabase.from('users').select('*');
        const { data: rolesData } = await supabase.from('roles').select('*');

        if (usersData) {
            setUsersState(usersData.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password: '',
                avatar: u.avatar,
                roleId: u.role_id,
                status: u.status,
            })));
        }

        if (rolesData) {
            setRolesState(rolesData.map(r => ({
                id: r.id,
                name: r.name,
                permissions: r.permissions || [],
            })));
        }
    };

    // Login function
    const login = useCallback(async (email: string, password: string): Promise<void> => {
        if (!useSupabase) {
            // Fallback to localStorage login
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const user = localUsers.find(u => u.email === email && u.password === password && u.status === 'active');
                    if (user) {
                        sessionStorage.setItem('currentUserId', user.id);
                        const role = localRoles.find(r => r.id === user.roleId);
                        setAuthState({
                            user,
                            role: role || null,
                            isLoading: false,
                            isAuthenticated: true,
                        });
                        resolve();
                    } else {
                        reject('Email hoặc mật khẩu không đúng.');
                    }
                }, 800);
            });
        }

        // Supabase Auth login
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            throw new Error(error.message);
        }
    }, [useSupabase, localUsers, localRoles]);

    // Logout function
    const logout = useCallback(async () => {
        if (!useSupabase) {
            sessionStorage.removeItem('currentUserId');
            setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
            return;
        }

        await supabase.auth.signOut();
        setAuthState({ user: null, role: null, isLoading: false, isAuthenticated: false });
    }, [useSupabase]);

    // Check permission
    const hasPermission = useCallback((permission: Permission): boolean => {
        if (!authState.role) return false;
        return authState.role.permissions.includes(permission);
    }, [authState.role]);

    // Update user profile
    const updateProfile = useCallback(async (updatedUser: Partial<User>) => {
        if (!authState.user) return;

        if (!useSupabase) {
            const newUser = { ...authState.user, ...updatedUser };
            setLocalUsers(prev => prev.map(u => u.id === authState.user!.id ? newUser : u));
            setAuthState(prev => ({ ...prev, user: newUser }));
            return;
        }

        const { error } = await supabase
            .from('users')
            .update({
                name: updatedUser.name,
                avatar: updatedUser.avatar,
            })
            .eq('id', authState.user.id);

        if (!error) {
            setAuthState(prev => ({
                ...prev,
                user: prev.user ? { ...prev.user, ...updatedUser } : null,
            }));
        }
    }, [authState.user, useSupabase, setLocalUsers]);

    // Set users (for admin)
    const setUsers = useCallback((updater: User[] | ((prev: User[]) => User[])) => {
        if (!useSupabase) {
            setLocalUsers(updater);
            if (typeof updater === 'function') {
                setUsersState(prev => updater(prev));
            } else {
                setUsersState(updater);
            }
        }
        // For Supabase: would need to sync with database
    }, [useSupabase, setLocalUsers]);

    // Set roles (for admin)
    const setRoles = useCallback((updater: Role[] | ((prev: Role[]) => Role[])) => {
        if (!useSupabase) {
            setLocalRoles(updater);
            if (typeof updater === 'function') {
                setRolesState(prev => updater(prev));
            } else {
                setRolesState(updater);
            }
        }
        // For Supabase: would need to sync with database
    }, [useSupabase, setLocalRoles]);

    return {
        currentUser: authState.user,
        currentRole: authState.role,
        isLoading: authState.isLoading,
        isAuthenticated: authState.isAuthenticated,
        login,
        logout,
        hasPermission,
        updateProfile,
        users,
        setUsers,
        roles,
        setRoles,
        source: useSupabase ? 'supabase' : 'localStorage',
    };
}
