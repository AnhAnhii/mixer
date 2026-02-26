// hooks/useData.ts
// Unified data hook - chọn giữa localStorage và Supabase

import { useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
    useProducts as useSupabaseProducts,
    useCustomers as useSupabaseCustomers,
    useOrders as useSupabaseOrders,
    useVouchers as useSupabaseVouchers,
    useActivityLogs as useSupabaseActivityLogs,
    useReturnRequests as useSupabaseReturnRequests,
    useAutomationRules as useSupabaseAutomationRules,
    useSettings,
    useSupabaseStatus,
} from './useSupabase';
import { isSupabaseConfigured } from '../lib/supabase';
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

// Sample data for localStorage fallback
import { sampleProducts, sampleCustomers, sampleOrders, sampleActivityLogs, sampleAutomationRules, sampleReturnRequests } from '../data/sampleData';

// ==================== UNIFIED DATA PROVIDER ====================

type DataSource = 'supabase' | 'localStorage';

// Check data source preference
function getDataSource(): DataSource {
    return isSupabaseConfigured() ? 'supabase' : 'localStorage';
}

// ==================== PRODUCTS ====================

export function useProductsData() {
    const source = getDataSource();

    // Supabase
    const supabase = useSupabaseProducts();

    // LocalStorage fallback
    const [localProducts, setLocalProducts] = useLocalStorage<Product[]>('products-v2', sampleProducts);

    if (source === 'supabase') {
        return {
            products: supabase.products,
            isLoading: supabase.isLoading,
            setProducts: () => { }, // Supabase doesn't use direct setters
            addProduct: supabase.addProduct,
            updateProduct: supabase.updateProduct,
            deleteProduct: supabase.deleteProduct,
            source: 'supabase' as const,
        };
    }

    return {
        products: localProducts,
        isLoading: false,
        setProducts: setLocalProducts,
        addProduct: async (product: Omit<Product, 'id'>) => {
            const newProduct = { ...product, id: crypto.randomUUID() } as Product;
            setLocalProducts(prev => [newProduct, ...prev]);
            return newProduct;
        },
        updateProduct: async (id: string, product: Partial<Product>) => {
            setLocalProducts(prev => prev.map(p => p.id === id ? { ...p, ...product } : p));
            return true;
        },
        deleteProduct: async (id: string) => {
            setLocalProducts(prev => prev.filter(p => p.id !== id));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== CUSTOMERS ====================

export function useCustomersData() {
    const source = getDataSource();

    const supabase = useSupabaseCustomers();
    const [localCustomers, setLocalCustomers] = useLocalStorage<Customer[]>('customers-v2', sampleCustomers);

    if (source === 'supabase') {
        return {
            customers: supabase.customers,
            isLoading: supabase.isLoading,
            setCustomers: () => { },
            addCustomer: supabase.addCustomer,
            updateCustomer: supabase.updateCustomer,
            deleteCustomer: supabase.deleteCustomer,
            source: 'supabase' as const,
        };
    }

    return {
        customers: localCustomers,
        isLoading: false,
        setCustomers: setLocalCustomers,
        addCustomer: async (customer: Omit<Customer, 'id'>) => {
            const newCustomer = { ...customer, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as Customer;
            setLocalCustomers(prev => [newCustomer, ...prev]);
            return newCustomer;
        },
        updateCustomer: async (id: string, customer: Partial<Customer>) => {
            setLocalCustomers(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
            return true;
        },
        deleteCustomer: async (id: string) => {
            setLocalCustomers(prev => prev.filter(c => c.id !== id));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== ORDERS ====================

export function useOrdersData() {
    const source = getDataSource();

    const supabase = useSupabaseOrders();
    const [localOrders, setLocalOrders] = useLocalStorage<Order[]>('orders-v2', sampleOrders);

    if (source === 'supabase') {
        return {
            orders: supabase.orders,
            isLoading: supabase.isLoading,
            setOrders: () => { },
            addOrder: supabase.addOrder,
            updateOrder: supabase.updateOrder,
            updateOrderStatus: supabase.updateOrderStatus,
            deleteOrder: supabase.deleteOrder,
            source: 'supabase' as const,
        };
    }

    return {
        orders: localOrders,
        isLoading: false,
        setOrders: setLocalOrders,
        addOrder: async (order: Omit<Order, 'id'>) => {
            const newOrder = { ...order, id: crypto.randomUUID() } as Order;
            setLocalOrders(prev => [newOrder, ...prev]);
            return newOrder;
        },
        updateOrder: async (id: string, order: Partial<Order>) => {
            setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, ...order } : o));
            return true;
        },
        updateOrderStatus: async (id: string, status: string) => {
            setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
            return true;
        },
        deleteOrder: async (id: string) => {
            setLocalOrders(prev => prev.filter(o => o.id !== id));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== VOUCHERS ====================

export function useVouchersData() {
    const source = getDataSource();

    const supabase = useSupabaseVouchers();
    const [localVouchers, setLocalVouchers] = useLocalStorage<Voucher[]>('vouchers-v2', []);

    if (source === 'supabase') {
        return {
            vouchers: supabase.vouchers,
            isLoading: supabase.isLoading,
            setVouchers: () => { },
            addVoucher: supabase.addVoucher,
            updateVoucher: supabase.updateVoucher,
            deleteVoucher: supabase.deleteVoucher,
            source: 'supabase' as const,
        };
    }

    return {
        vouchers: localVouchers,
        isLoading: false,
        setVouchers: setLocalVouchers,
        addVoucher: async (voucher: Omit<Voucher, 'id'>) => {
            const newVoucher = { ...voucher, id: crypto.randomUUID() } as Voucher;
            setLocalVouchers(prev => [newVoucher, ...prev]);
            return newVoucher;
        },
        updateVoucher: async (id: string, voucher: Partial<Voucher>) => {
            setLocalVouchers(prev => prev.map(v => v.id === id ? { ...v, ...voucher } : v));
            return true;
        },
        deleteVoucher: async (id: string) => {
            setLocalVouchers(prev => prev.filter(v => v.id !== id));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== SETTINGS ====================

export function useBankInfoData() {
    const source = getDataSource();

    const supabase = useSettings<BankInfo | null>('bank_info', null);
    const [localBankInfo, setLocalBankInfo] = useLocalStorage<BankInfo | null>('bankInfo-v2', null);

    if (source === 'supabase') {
        return {
            bankInfo: supabase.value,
            setBankInfo: supabase.setValue,
            isLoading: supabase.isLoading,
            source: 'supabase' as const,
        };
    }

    return {
        bankInfo: localBankInfo,
        setBankInfo: async (value: BankInfo | null) => setLocalBankInfo(value),
        isLoading: false,
        source: 'localStorage' as const,
    };
}

export function useThemeData() {
    const source = getDataSource();

    const defaultTheme: ThemeSettings = { palette: 'modern', density: 'comfortable', style: 'rounded' };
    const supabase = useSettings<ThemeSettings>('theme', defaultTheme);
    const [localTheme, setLocalTheme] = useLocalStorage<ThemeSettings>('themeSettings-v2', defaultTheme);

    if (source === 'supabase') {
        return {
            theme: supabase.value,
            setTheme: supabase.setValue,
            isLoading: supabase.isLoading,
            source: 'supabase' as const,
        };
    }

    return {
        theme: localTheme,
        setTheme: async (value: ThemeSettings) => setLocalTheme(value),
        isLoading: false,
        source: 'localStorage' as const,
    };
}

// ==================== ACTIVITY LOGS ====================

export function useActivityLogsData() {
    const source = getDataSource();

    const supabase = useSupabaseActivityLogs();
    const [localLogs, setLocalLogs] = useLocalStorage<ActivityLog[]>('activityLog-v2', sampleActivityLogs);

    if (source === 'supabase') {
        return {
            logs: supabase.logs,
            isLoading: supabase.isLoading,
            setLogs: () => { },
            addLog: supabase.addLog,
            source: 'supabase' as const,
        };
    }

    return {
        logs: localLogs,
        isLoading: false,
        setLogs: setLocalLogs,
        addLog: async (log: Omit<ActivityLog, 'id'>) => {
            const newLog = { ...log, id: crypto.randomUUID() } as ActivityLog;
            setLocalLogs(prev => [newLog, ...prev]);
        },
        source: 'localStorage' as const,
    };
}

// ==================== AUTOMATION RULES ====================

export function useAutomationRulesData() {
    const source = getDataSource();

    const supabase = useSupabaseAutomationRules();
    const [localRules, setLocalRules] = useLocalStorage<AutomationRule[]>('automationRules-v2', sampleAutomationRules);

    if (source === 'supabase') {
        return {
            rules: supabase.rules,
            isLoading: supabase.isLoading,
            setRules: () => { },
            addRule: supabase.addRule,
            updateRule: supabase.updateRule,
            deleteRule: supabase.deleteRule,
            toggleRule: supabase.toggleRule,
            source: 'supabase' as const,
        };
    }

    return {
        rules: localRules,
        isLoading: false,
        setRules: setLocalRules,
        addRule: async (rule: Omit<AutomationRule, 'id'>) => {
            const newRule = { ...rule, id: crypto.randomUUID() } as AutomationRule;
            setLocalRules(prev => [newRule, ...prev]);
            return newRule;
        },
        updateRule: async (id: string, rule: Partial<AutomationRule>) => {
            setLocalRules(prev => prev.map(r => r.id === id ? { ...r, ...rule } : r));
            return true;
        },
        deleteRule: async (id: string) => {
            setLocalRules(prev => prev.filter(r => r.id !== id));
            return true;
        },
        toggleRule: async (id: string, isEnabled: boolean) => {
            setLocalRules(prev => prev.map(r => r.id === id ? { ...r, isEnabled } : r));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== RETURN REQUESTS ====================

export function useReturnRequestsData() {
    const source = getDataSource();

    const supabase = useSupabaseReturnRequests();
    const [localRequests, setLocalRequests] = useLocalStorage<ReturnRequest[]>('returnRequests-v2', sampleReturnRequests);

    if (source === 'supabase') {
        return {
            returnRequests: supabase.returnRequests,
            isLoading: supabase.isLoading,
            setReturnRequests: (val: any) => { }, // No-op for Supabase
            updateStatus: supabase.updateStatus,
            source: 'supabase' as const,
        };
    }

    return {
        returnRequests: localRequests,
        isLoading: false,
        setReturnRequests: setLocalRequests,
        updateStatus: async (id: string, status: string) => {
            setLocalRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
            return true;
        },
        source: 'localStorage' as const,
    };
}

// ==================== DATA SOURCE STATUS ====================

export function useDataSourceStatus() {
    const { isConfigured, isConnected } = useSupabaseStatus();
    const source = getDataSource();

    return {
        source,
        isSupabaseConfigured: isConfigured,
        isSupabaseConnected: isConnected,
    };
}

// ==================== SOCIAL CONFIGS ====================

export function useSocialConfigsData() {
    const source = getDataSource();

    const supabase = useSettings<any[]>('social_configs', []);
    const [localConfigs, setLocalConfigs] = useLocalStorage<any[]>('socialConfigs-v2', []);

    if (source === 'supabase') {
        return {
            socialConfigs: supabase.value || [],
            setSocialConfigs: supabase.setValue,
            isLoading: supabase.isLoading,
            source: 'supabase' as const,
        };
    }

    return {
        socialConfigs: localConfigs,
        setSocialConfigs: async (value: any[]) => setLocalConfigs(value),
        isLoading: false,
        source: 'localStorage' as const,
    };
}

// ==================== UI MODE ====================

export function useUiModeData() {
    const source = getDataSource();

    const supabase = useSettings<string>('ui_mode', 'default');
    const [localMode, setLocalMode] = useLocalStorage<string>('uiMode-v2', 'default');

    if (source === 'supabase') {
        return {
            uiMode: supabase.value || 'default',
            setUiMode: supabase.setValue,
            isLoading: supabase.isLoading,
            source: 'supabase' as const,
        };
    }

    return {
        uiMode: localMode,
        setUiMode: async (value: string) => setLocalMode(value),
        isLoading: false,
        source: 'localStorage' as const,
    };
}
