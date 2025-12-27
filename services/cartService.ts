// services/cartService.ts
// Virtual Cart Service - Quản lý giỏ hàng ảo cho khách chat qua Facebook

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CartItem {
    id: string;
    cart_id: string;
    product_id: string | null;
    product_name: string;
    variant_id: string | null;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price: number;
    created_at: string;
}

export interface Cart {
    id: string;
    facebook_user_id: string;
    customer_name: string | null;
    customer_phone: string | null;
    created_at: string;
    updated_at: string;
    items?: CartItem[];
}

export const cartService = {
    // Lấy hoặc tạo giỏ hàng cho Facebook user
    async getOrCreateCart(facebookUserId: string, customerName?: string): Promise<Cart | null> {
        if (!isSupabaseConfigured()) return null;

        // Tìm cart hiện có
        const { data: existingCart } = await supabase
            .from('carts')
            .select('*')
            .eq('facebook_user_id', facebookUserId)
            .single();

        if (existingCart) {
            return existingCart as Cart;
        }

        // Tạo cart mới
        const { data: newCart, error } = await supabase
            .from('carts')
            .insert({
                facebook_user_id: facebookUserId,
                customer_name: customerName || null
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating cart:', error);
            return null;
        }

        return newCart as Cart;
    },

    // Lấy giỏ hàng với tất cả items
    async getCart(facebookUserId: string): Promise<Cart | null> {
        if (!isSupabaseConfigured()) return null;

        const { data: cart, error } = await supabase
            .from('carts')
            .select(`
                *,
                items:cart_items(*)
            `)
            .eq('facebook_user_id', facebookUserId)
            .single();

        if (error || !cart) {
            return null;
        }

        return cart as Cart;
    },

    // Thêm sản phẩm vào giỏ
    async addItem(
        facebookUserId: string,
        item: {
            product_id?: string;
            product_name: string;
            variant_id?: string;
            size?: string;
            color?: string;
            quantity: number;
            unit_price: number;
        }
    ): Promise<CartItem | null> {
        if (!isSupabaseConfigured()) return null;

        // Lấy hoặc tạo cart
        const cart = await this.getOrCreateCart(facebookUserId);
        if (!cart) return null;

        // Kiểm tra xem sản phẩm đã có trong giỏ chưa (cùng size, color)
        const { data: existingItem } = await supabase
            .from('cart_items')
            .select('*')
            .eq('cart_id', cart.id)
            .eq('product_name', item.product_name)
            .eq('size', item.size || '')
            .eq('color', item.color || '')
            .single();

        if (existingItem) {
            // Cập nhật số lượng
            const { data: updatedItem, error } = await supabase
                .from('cart_items')
                .update({ quantity: existingItem.quantity + item.quantity })
                .eq('id', existingItem.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating cart item:', error);
                return null;
            }
            return updatedItem as CartItem;
        }

        // Thêm item mới
        const { data: newItem, error } = await supabase
            .from('cart_items')
            .insert({
                cart_id: cart.id,
                product_id: item.product_id || null,
                product_name: item.product_name,
                variant_id: item.variant_id || null,
                size: item.size || null,
                color: item.color || null,
                quantity: item.quantity,
                unit_price: item.unit_price
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding cart item:', error);
            return null;
        }

        return newItem as CartItem;
    },

    // Xóa sản phẩm khỏi giỏ
    async removeItem(facebookUserId: string, itemId: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const cart = await this.getCart(facebookUserId);
        if (!cart) return false;

        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId)
            .eq('cart_id', cart.id);

        return !error;
    },

    // Xóa toàn bộ giỏ hàng
    async clearCart(facebookUserId: string): Promise<boolean> {
        if (!isSupabaseConfigured()) return false;

        const cart = await this.getCart(facebookUserId);
        if (!cart) return false;

        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id);

        return !error;
    },

    // Tính tổng giỏ hàng
    getCartTotal(cart: Cart): { itemCount: number; totalAmount: number } {
        if (!cart.items || cart.items.length === 0) {
            return { itemCount: 0, totalAmount: 0 };
        }

        const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = cart.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

        return { itemCount, totalAmount };
    },

    // Format giỏ hàng thành message
    formatCartMessage(cart: Cart): string {
        if (!cart.items || cart.items.length === 0) {
            return '🛒 Giỏ hàng của bạn đang trống.\nGõ "thêm [tên sản phẩm] vào giỏ" để bắt đầu mua sắm!';
        }

        const formatCurrency = (amount: number) =>
            new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

        const { itemCount, totalAmount } = this.getCartTotal(cart);

        const itemsList = cart.items.map((item, index) => {
            const sizeColor = [item.size, item.color].filter(Boolean).join(' - ');
            return `${index + 1}. ${item.product_name}${sizeColor ? ` (${sizeColor})` : ''} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}`;
        }).join('\n');

        return `🛒 **Giỏ hàng của bạn** (${itemCount} sản phẩm)

${itemsList}

💰 **Tổng cộng: ${formatCurrency(totalAmount)}**

📝 Gõ "đặt hàng" để checkout
🗑️ Gõ "xóa giỏ" để xóa toàn bộ`;
    }
};
