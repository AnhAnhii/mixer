// services/supabaseService.ts
// Supabase CRUD operations for all entities

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
    Product,
    ProductVariant,
    Customer,
    Order,
    OrderItem,
    Voucher,
    ActivityLog,
    AutomationRule,
    ReturnRequest,
    BankInfo,
    ThemeSettings,
    SocialPostConfig,
} from '../types';

// ==================== PRODUCTS ====================

export const productService = {
    async getAll(): Promise<Product[]> {
        if (!isSupabaseConfigured()) return [];

        const { data: products, error } = await supabase
            .from('products')
            .select(`
                *,
                product_variants (*)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }

        // Transform to match local type
        return (products || []).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            costPrice: p.cost_price,
            variants: (p.product_variants || []).map((v: any) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                stock: v.stock,
                lowStockThreshold: v.low_stock_threshold,
            })),
        }));
    },

    async create(product: Omit<Product, 'id'>): Promise<Product | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('products')
            .insert({
                name: product.name,
                price: product.price,
                cost_price: product.costPrice,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating product:', error);
            return null;
        }

        // Insert variants
        if (product.variants?.length) {
            await supabase.from('product_variants').insert(
                product.variants.map(v => ({
                    product_id: data.id,
                    size: v.size,
                    color: v.color,
                    stock: v.stock,
                    low_stock_threshold: v.lowStockThreshold,
                }))
            );
        }

        return { ...product, id: data.id };
    },

    async update(id: string, product: Partial<Product>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('products')
            .update({
                name: product.name,
                price: product.price,
                cost_price: product.costPrice,
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating product:', error);
            return false;
        }

        // Update variants: delete old ones and insert new ones
        if (product.variants) {
            // Delete existing variants
            await supabase
                .from('product_variants')
                .delete()
                .eq('product_id', id);

            // Insert new variants
            if (product.variants.length > 0) {
                const { error: variantError } = await supabase
                    .from('product_variants')
                    .insert(
                        product.variants.map(v => ({
                            product_id: id,
                            size: v.size,
                            color: v.color,
                            stock: v.stock,
                            low_stock_threshold: v.lowStockThreshold,
                        }))
                    );

                if (variantError) {
                    console.error('Error updating variants:', variantError);
                    return false;
                }
            }
        }

        return true;
    },

    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', id);

        return !error;
    },
};

// ==================== CUSTOMERS ====================

export const customerService = {
    async getAll(): Promise<Customer[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            return [];
        }

        return (data || []).map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            createdAt: c.created_at,
            tags: c.tags || [],
        }));
    },

    async create(customer: Omit<Customer, 'id'>): Promise<Customer | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('customers')
            .insert({
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                tags: customer.tags,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating customer:', error);
            return null;
        }

        return { ...customer, id: data.id, createdAt: data.created_at };
    },

    async update(id: string, customer: Partial<Customer>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('customers')
            .update({
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                tags: customer.tags,
            })
            .eq('id', id);

        return !error;
    },

    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        return !error;
    },

    async findByPhone(phone: string): Promise<Customer | null> {
        if (!isSupabaseConfigured()) return null;

        const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', phone)
            .single();

        return data ? {
            id: data.id,
            name: data.name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            createdAt: data.created_at,
            tags: data.tags || [],
        } : null;
    },
};

// ==================== ORDERS ====================

export const orderService = {
    async getAll(): Promise<Order[]> {
        if (!isSupabaseConfigured()) return [];

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                order_discussions (*)
            `)
            .order('order_date', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            return [];
        }

        return (orders || []).map(o => ({
            id: o.id,
            customerId: o.customer_id,
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            shippingAddress: o.shipping_address,
            orderDate: o.order_date,
            items: (o.order_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                variantId: i.variant_id,
                size: i.size,
                color: i.color,
                quantity: i.quantity,
                price: i.price,
                costPrice: i.cost_price,
            })),
            totalAmount: o.total_amount,
            status: o.status,
            paymentMethod: o.payment_method,
            paymentStatus: o.payment_status,
            notes: o.notes,
            discount: o.discount_code ? {
                code: o.discount_code,
                amount: o.discount_amount,
            } : undefined,
            shippingProvider: o.shipping_provider,
            trackingCode: o.tracking_code,
            discussion: (o.order_discussions || []).map((d: any) => ({
                id: d.id,
                authorId: d.author_id,
                authorName: d.author_name,
                authorAvatar: d.author_avatar,
                timestamp: d.created_at,
                text: d.text,
            })),
            facebookUserId: o.facebook_user_id,
            facebookUserName: o.facebook_user_name,
        }));
    },

    async create(order: Omit<Order, 'id'>): Promise<Order | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('orders')
            .insert({
                customer_id: order.customerId,
                customer_name: order.customerName,
                customer_phone: order.customerPhone,
                shipping_address: order.shippingAddress,
                total_amount: order.totalAmount,
                status: order.status,
                payment_method: order.paymentMethod,
                payment_status: order.paymentStatus,
                notes: order.notes,
                discount_code: order.discount?.code,
                discount_amount: order.discount?.amount,
                facebook_user_id: order.facebookUserId,
                facebook_user_name: order.facebookUserName,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating order:', error);
            return null;
        }

        // Insert order items
        if (order.items?.length) {
            await supabase.from('order_items').insert(
                order.items.map(i => ({
                    order_id: data.id,
                    product_id: i.productId,
                    variant_id: i.variantId,
                    product_name: i.productName,
                    size: i.size,
                    color: i.color,
                    quantity: i.quantity,
                    price: i.price,
                    cost_price: i.costPrice,
                }))
            );
        }

        return { ...order, id: data.id };
    },

    async update(id: string, order: Partial<Order>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('orders')
            .update({
                status: order.status,
                payment_status: order.paymentStatus,
                shipping_provider: order.shippingProvider,
                tracking_code: order.trackingCode,
                notes: order.notes,
            })
            .eq('id', id);

        return !error;
    },

    async updateStatus(id: string, status: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', id);

        return !error;
    },

    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        return !error;
    },
};

// ==================== VOUCHERS ====================

export const voucherService = {
    async getAll(): Promise<Voucher[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('vouchers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map(v => ({
            id: v.id,
            code: v.code,
            discountType: v.discount_type,
            discountValue: v.discount_value,
            minOrderValue: v.min_order_value,
            isActive: v.is_active,
            usageCount: v.usage_count,
        }));
    },

    async create(voucher: Omit<Voucher, 'id'>): Promise<Voucher | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('vouchers')
            .insert({
                code: voucher.code,
                discount_type: voucher.discountType,
                discount_value: voucher.discountValue,
                min_order_value: voucher.minOrderValue,
                is_active: voucher.isActive,
            })
            .select()
            .single();

        if (error) return null;
        return { ...voucher, id: data.id };
    },

    async update(id: string, voucher: Partial<Voucher>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('vouchers')
            .update({
                code: voucher.code,
                discount_type: voucher.discountType,
                discount_value: voucher.discountValue,
                min_order_value: voucher.minOrderValue,
                is_active: voucher.isActive,
            })
            .eq('id', id);

        return !error;
    },

    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('vouchers')
            .delete()
            .eq('id', id);

        return !error;
    },
};

// ==================== ACTIVITY LOGS ====================

export const activityLogService = {
    async getAll(limit = 100): Promise<ActivityLog[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];

        return (data || []).map(l => ({
            id: l.id,
            timestamp: l.created_at,
            description: l.description,
            entityId: l.entity_id,
            entityType: l.entity_type,
        }));
    },

    async create(log: Omit<ActivityLog, 'id'>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('activity_logs')
            .insert({
                description: log.description,
                entity_id: log.entityId,
                entity_type: log.entityType,
            });

        return !error;
    },
};

// ==================== SETTINGS ====================

export const settingsService = {
    async get<T>(key: string): Promise<T | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) return null;
        return data?.value as T;
    },

    async set<T>(key: string, value: T): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('settings')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });

        return !error;
    },

    async getBankInfo(): Promise<BankInfo | null> {
        return this.get<BankInfo>('bank_info');
    },

    async setBankInfo(bankInfo: BankInfo): Promise<boolean> {
        return this.set('bank_info', bankInfo);
    },

    async getTheme(): Promise<ThemeSettings | null> {
        return this.get<ThemeSettings>('theme');
    },

    async setTheme(theme: ThemeSettings): Promise<boolean> {
        return this.set('theme', theme);
    },
};

// ==================== AI TRAINING DATA ====================

export const aiTrainingService = {
    async getAll(): Promise<Array<{ customerMessage: string; employeeResponse: string; category?: string }>> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('ai_training_data')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map(d => ({
            customerMessage: d.customer_message,
            employeeResponse: d.employee_response,
            category: d.category,
        }));
    },

    async bulkInsert(pairs: Array<{ customerMessage: string; employeeResponse: string; category?: string }>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('ai_training_data')
            .insert(pairs.map(p => ({
                customer_message: p.customerMessage,
                employee_response: p.employeeResponse,
                category: p.category,
            })));

        return !error;
    },
};

// ==================== RETURN REQUESTS ====================

export const returnRequestService = {
    async getAll(): Promise<ReturnRequest[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('return_requests')
            .select(`
                *,
                return_request_items (*)
            `)
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map(r => ({
            id: r.id,
            orderId: r.order_id,
            customerId: r.customer_id,
            customerName: r.customer_name,
            createdAt: r.created_at,
            status: r.status,
            items: (r.return_request_items || []).map((i: any) => ({
                originalOrderItem: {
                    productId: '',
                    productName: i.product_name,
                    variantId: '',
                    size: i.size,
                    color: i.color,
                    quantity: i.quantity,
                    price: 0,
                    costPrice: 0,
                },
                quantity: i.quantity,
                action: i.action,
                reason: i.reason,
                newVariantId: i.new_variant_id,
            })),
            returnTrackingCode: r.return_tracking_code,
            exchangeTrackingCode: r.exchange_tracking_code,
            exchangeShippingFee: r.exchange_shipping_fee,
        }));
    },

    async updateStatus(id: string, status: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('return_requests')
            .update({ status })
            .eq('id', id);

        return !error;
    },
};

// ==================== AUTOMATION RULES ====================

export const automationRuleService = {
    async getAll(): Promise<AutomationRule[]> {
        if (!isSupabaseConfigured()) return [];

        const { data, error } = await supabase
            .from('automation_rules')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return [];

        return (data || []).map(r => ({
            id: r.id,
            name: r.name,
            trigger: r.trigger_type,
            conditions: r.conditions || [],
            actions: r.actions || [],
            isEnabled: r.is_enabled,
        }));
    },

    async create(rule: Omit<AutomationRule, 'id'>): Promise<AutomationRule | null> {
        if (!isSupabaseConfigured()) return null;

        const { data, error } = await supabase
            .from('automation_rules')
            .insert({
                name: rule.name,
                trigger_type: rule.trigger,
                conditions: rule.conditions,
                actions: rule.actions,
                is_enabled: rule.isEnabled,
            })
            .select()
            .single();

        if (error) return null;
        return { ...rule, id: data.id };
    },

    async update(id: string, rule: Partial<AutomationRule>): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('automation_rules')
            .update({
                name: rule.name,
                trigger_type: rule.trigger,
                conditions: rule.conditions,
                actions: rule.actions,
                is_enabled: rule.isEnabled,
            })
            .eq('id', id);

        return !error;
    },

    async delete(id: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('automation_rules')
            .delete()
            .eq('id', id);

        return !error;
    },

    async toggle(id: string, isEnabled: boolean): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const { error } = await supabase
            .from('automation_rules')
            .update({ is_enabled: isEnabled })
            .eq('id', id);

        return !error;
    },
};

// ==================== EXPORT ALL ====================

export {
    supabase,
    isSupabaseConfigured,
};
