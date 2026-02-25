/**
 * AppContext — wraps all providers for the Mixer app.
 * Import this single provider in index.tsx instead of nesting 5+ providers manually.
 */

import React from 'react';
import { ToastProvider } from '../components/Toast';
import { ModalProvider } from './ModalContext';
import { OrderProvider } from './OrderContext';
import { CustomerProvider } from './CustomerContext';
import { ProductProvider } from './ProductContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <ModalProvider>
                <ProductProvider>
                    <CustomerProvider>
                        <OrderProvider>
                            {children}
                        </OrderProvider>
                    </CustomerProvider>
                </ProductProvider>
            </ModalProvider>
        </ToastProvider>
    );
}

// Re-export all hooks for convenience
export { useModal } from './ModalContext';
export { useOrders } from './OrderContext';
export { useCustomers } from './CustomerContext';
export { useProducts } from './ProductContext';
