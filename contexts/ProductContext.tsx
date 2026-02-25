import React, { createContext, useContext, useCallback } from 'react';
import type { Product } from '../types';
import { useProductsData } from '../hooks/useData';
import { productService } from '../services/supabaseService';

interface ProductContextValue {
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    isLoading: boolean;
    source: string;
    addProduct: (product: Omit<Product, 'id'>) => Promise<Product | null>;
    updateProduct: (id: string, product: Partial<Product>) => Promise<boolean>;
    deleteProduct: (id: string) => Promise<void>;
    toggleVisibility: (id: string, isActive: boolean) => Promise<void>;
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const {
        products,
        setProducts,
        addProduct,
        updateProduct,
        deleteProduct: deleteProductFromDb,
        isLoading,
        source,
    } = useProductsData();

    const handleDelete = useCallback(async (productId: string) => {
        await deleteProductFromDb(productId);
    }, [deleteProductFromDb]);

    const handleToggleVisibility = useCallback(async (id: string, isActive: boolean) => {
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)));
        await productService.toggleVisibility(id, isActive);
    }, [setProducts]);

    return (
        <ProductContext.Provider
            value={{
                products,
                setProducts,
                isLoading,
                source,
                addProduct,
                updateProduct,
                deleteProduct: handleDelete,
                toggleVisibility: handleToggleVisibility,
            }}
        >
            {children}
        </ProductContext.Provider>
    );
}

export function useProducts() {
    const context = useContext(ProductContext);
    if (!context) throw new Error('useProducts must be used within ProductProvider');
    return context;
}
