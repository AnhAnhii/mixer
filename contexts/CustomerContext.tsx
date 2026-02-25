import React, { createContext, useContext, useCallback } from 'react';
import type { Customer } from '../types';
import { useCustomersData } from '../hooks/useData';

interface CustomerContextValue {
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    isLoading: boolean;
    addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer | null>;
    updateCustomer: (id: string, customer: Partial<Customer>) => Promise<boolean>;
    deleteCustomer: (id: string, logActivity?: (desc: string, entityId?: string, entityType?: string) => void, currentUserName?: string) => Promise<void>;
    bulkDeleteCustomers: (ids: string[]) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
    const {
        customers,
        setCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer: deleteCustomerFromDb,
        isLoading,
    } = useCustomersData();

    const handleDelete = useCallback(async (
        customerId: string,
        logActivity?: (desc: string, entityId?: string, entityType?: string) => void,
        currentUserName?: string,
    ) => {
        await deleteCustomerFromDb(customerId);
        logActivity?.(
            `<strong>${currentUserName}</strong> đã xóa khách hàng.`,
            customerId,
            'customer',
        );
    }, [deleteCustomerFromDb]);

    const handleBulkDelete = useCallback(async (customerIds: string[]) => {
        for (const id of customerIds) {
            await deleteCustomerFromDb(id);
        }
    }, [deleteCustomerFromDb]);

    return (
        <CustomerContext.Provider
            value={{
                customers,
                setCustomers,
                isLoading,
                addCustomer,
                updateCustomer,
                deleteCustomer: handleDelete,
                bulkDeleteCustomers: handleBulkDelete,
            }}
        >
            {children}
        </CustomerContext.Provider>
    );
}

export function useCustomers() {
    const context = useContext(CustomerContext);
    if (!context) throw new Error('useCustomers must be used within CustomerProvider');
    return context;
}
