// hooks/useSupabase.ts
// React hooks for Supabase data fetching and mutations

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
    productService,
    customerService,
    orderService,
    voucherService,
    activityLogService,
    settingsService,
    returnRequestService,
    automationRuleService,
} from '../services/supabaseService';
import type {
    Product,
    Customer,
    Order,
    Voucher,
    ActivityLog,
    ReturnRequest,
    AutomationRule,
    BankInfo,
    ThemeSettings,
} from '../types';

// Generic hook for Supabase data
function useSupabaseData<T>(
    fetchFn: () => Promise<T[]>,
    tableName: string,
    deps: any[] = []
) {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const mutatingRef = useRef(false);

    const refetch = useCallback(async () => {
        if (!isSupabaseConfigured()) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await fetchFn();
            setData(result);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn]);

    useEffect(() => {
        refetch();

        // Subscribe to realtime changes (with debounce to avoid overwriting optimistic updates)
        if (isSupabaseConfigured()) {
            const subscription = supabase
                .channel(`${tableName}_changes`)
                .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
                    // Skip refetch if we just did a mutation (optimistic update is already correct)
                    if (mutatingRef.current) return;
                    refetch();
                })
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, deps);

    // Wrapper to pause realtime during mutations
    const mutate = useCallback(async <R>(fn: () => Promise<R>): Promise<R> => {
        mutatingRef.current = true;
        try {
            const result = await fn();
            return result;
        } finally {
            // Resume realtime after a delay to let DB settle
            setTimeout(() => { mutatingRef.current = false; }, 2000);
        }
    }, []);

    return { data, isLoading, error, refetch, setData, mutate };
}

// ==================== PRODUCTS ====================

export function useProducts() {
    const { data: products, isLoading, error, refetch, setData, mutate } = useSupabaseData<Product>(
        productService.getAll,
        'products'
    );

    const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
        return mutate(async () => {
            const newProduct = await productService.create(product);
            if (newProduct) {
                setData(prev => [newProduct, ...prev]);
            }
            return newProduct;
        });
    }, [setData, mutate]);

    const updateProduct = useCallback(async (id: string, product: Partial<Product>) => {
        return mutate(async () => {
            const success = await productService.update(id, product);
            if (success) {
                setData(prev => prev.map(p => p.id === id ? { ...p, ...product } : p));
            }
            return success;
        });
    }, [setData, mutate]);

    const deleteProduct = useCallback(async (id: string) => {
        return mutate(async () => {
            const success = await productService.delete(id);
            if (success) {
                setData(prev => prev.filter(p => p.id !== id));
            }
            return success;
        });
    }, [setData, mutate]);

    return { products, isLoading, error, refetch, addProduct, updateProduct, deleteProduct };
}

// ==================== CUSTOMERS ====================

export function useCustomers() {
    const { data: customers, isLoading, error, refetch, setData } = useSupabaseData<Customer>(
        customerService.getAll,
        'customers'
    );

    const addCustomer = useCallback(async (customer: Omit<Customer, 'id'>) => {
        const newCustomer = await customerService.create(customer);
        if (newCustomer) {
            setData(prev => [newCustomer, ...prev]);
        }
        return newCustomer;
    }, [setData]);

    const updateCustomer = useCallback(async (id: string, customer: Partial<Customer>) => {
        const success = await customerService.update(id, customer);
        if (success) {
            setData(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
        }
        return success;
    }, [setData]);

    const deleteCustomer = useCallback(async (id: string) => {
        const success = await customerService.delete(id);
        if (success) {
            setData(prev => prev.filter(c => c.id !== id));
        }
        return success;
    }, [setData]);

    return { customers, isLoading, error, refetch, addCustomer, updateCustomer, deleteCustomer };
}

// ==================== ORDERS ====================

export function useOrders() {
    const { data: orders, isLoading, error, refetch, setData } = useSupabaseData<Order>(
        orderService.getAll,
        'orders'
    );

    const addOrder = useCallback(async (order: Omit<Order, 'id'>) => {
        const newOrder = await orderService.create(order);
        if (newOrder) {
            setData(prev => [newOrder, ...prev]);
        }
        return newOrder;
    }, [setData]);

    const updateOrder = useCallback(async (id: string, order: Partial<Order>) => {
        const success = await orderService.update(id, order);
        if (success) {
            setData(prev => prev.map(o => o.id === id ? { ...o, ...order } : o));
        }
        return success;
    }, [setData]);

    const updateOrderStatus = useCallback(async (id: string, status: string) => {
        const success = await orderService.updateStatus(id, status);
        if (success) {
            setData(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
        }
        return success;
    }, [setData]);

    const deleteOrder = useCallback(async (id: string) => {
        const success = await orderService.delete(id);
        if (success) {
            setData(prev => prev.filter(o => o.id !== id));
        }
        return success;
    }, [setData]);

    return { orders, isLoading, error, refetch, addOrder, updateOrder, updateOrderStatus, deleteOrder };
}

// ==================== VOUCHERS ====================

export function useVouchers() {
    const { data: vouchers, isLoading, error, refetch, setData } = useSupabaseData<Voucher>(
        voucherService.getAll,
        'vouchers'
    );

    const addVoucher = useCallback(async (voucher: Omit<Voucher, 'id'>) => {
        const newVoucher = await voucherService.create(voucher);
        if (newVoucher) {
            setData(prev => [newVoucher, ...prev]);
        }
        return newVoucher;
    }, [setData]);

    const updateVoucher = useCallback(async (id: string, voucher: Partial<Voucher>) => {
        const success = await voucherService.update(id, voucher);
        if (success) {
            setData(prev => prev.map(v => v.id === id ? { ...v, ...voucher } : v));
        }
        return success;
    }, [setData]);

    const deleteVoucher = useCallback(async (id: string) => {
        const success = await voucherService.delete(id);
        if (success) {
            setData(prev => prev.filter(v => v.id !== id));
        }
        return success;
    }, [setData]);

    return { vouchers, isLoading, error, refetch, addVoucher, updateVoucher, deleteVoucher };
}

// ==================== ACTIVITY LOGS ====================

export function useActivityLogs(limit = 100) {
    const { data: logs, isLoading, error, refetch } = useSupabaseData<ActivityLog>(
        () => activityLogService.getAll(limit),
        'activity_logs'
    );

    const addLog = useCallback(async (log: Omit<ActivityLog, 'id'>) => {
        await activityLogService.create(log);
        refetch();
    }, [refetch]);

    return { logs, isLoading, error, refetch, addLog };
}

// ==================== SETTINGS ====================

export function useSettings<T>(key: string, defaultValue: T) {
    const [value, setValue] = useState<T>(defaultValue);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const result = await settingsService.get<T>(key);
            if (result !== null) {
                setValue(result);
            }
            setIsLoading(false);
        }
        load();
    }, [key]);

    const updateValue = useCallback(async (newValue: T) => {
        setValue(newValue);
        await settingsService.set(key, newValue);
    }, [key]);

    return { value, setValue: updateValue, isLoading };
}

export function useBankInfo() {
    return useSettings<BankInfo | null>('bank_info', null);
}

export function useTheme() {
    return useSettings<ThemeSettings>('theme', {
        palette: 'modern',
        density: 'comfortable',
        style: 'rounded',
    });
}

// ==================== RETURN REQUESTS ====================

export function useReturnRequests() {
    const { data: returnRequests, isLoading, error, refetch, setData } = useSupabaseData<ReturnRequest>(
        returnRequestService.getAll,
        'return_requests'
    );

    const updateStatus = useCallback(async (id: string, status: string) => {
        const success = await returnRequestService.updateStatus(id, status);
        if (success) {
            setData(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
        }
        return success;
    }, [setData]);

    return { returnRequests, isLoading, error, refetch, updateStatus };
}

// ==================== AUTOMATION RULES ====================

export function useAutomationRules() {
    const { data: rules, isLoading, error, refetch, setData } = useSupabaseData<AutomationRule>(
        automationRuleService.getAll,
        'automation_rules'
    );

    const addRule = useCallback(async (rule: Omit<AutomationRule, 'id'>) => {
        const newRule = await automationRuleService.create(rule);
        if (newRule) {
            setData(prev => [newRule, ...prev]);
        }
        return newRule;
    }, [setData]);

    const updateRule = useCallback(async (id: string, rule: Partial<AutomationRule>) => {
        const success = await automationRuleService.update(id, rule);
        if (success) {
            setData(prev => prev.map(r => r.id === id ? { ...r, ...rule } : r));
        }
        return success;
    }, [setData]);

    const deleteRule = useCallback(async (id: string) => {
        const success = await automationRuleService.delete(id);
        if (success) {
            setData(prev => prev.filter(r => r.id !== id));
        }
        return success;
    }, [setData]);

    const toggleRule = useCallback(async (id: string, isEnabled: boolean) => {
        const success = await automationRuleService.toggle(id, isEnabled);
        if (success) {
            setData(prev => prev.map(r => r.id === id ? { ...r, isEnabled } : r));
        }
        return success;
    }, [setData]);

    return { rules, isLoading, error, refetch, addRule, updateRule, deleteRule, toggleRule };
}

// ==================== CHECK SUPABASE STATUS ====================

export function useSupabaseStatus() {
    const [isConfigured, setIsConfigured] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        setIsConfigured(isSupabaseConfigured());

        async function checkConnection() {
            if (isSupabaseConfigured()) {
                try {
                    const { error } = await supabase.from('settings').select('key').limit(1);
                    setIsConnected(!error);
                } catch {
                    setIsConnected(false);
                }
            }
        }
        checkConnection();
    }, []);

    return { isConfigured, isConnected };
}
