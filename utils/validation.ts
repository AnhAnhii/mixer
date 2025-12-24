
export function sanitizeString(input: string, maxLength = 1000): string {
    if (!input || typeof input !== 'string') return '';
    return input
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>"'&]/g, '') // Remove dangerous chars
        .trim()
        .substring(0, maxLength);
}

export function validateEmail(email: string): boolean {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePhone(phone: string): boolean {
    if (!phone) return false;
    // Remove common separators
    const cleaned = phone.replace(/[\s-]/g, '');
    // Check for VN phone format (start with 0 or +84, followed by 9-10 digits)
    return /^(0|\+?84)\d{9,10}$/.test(cleaned);
}

export function validateOrderData(order: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!order.customerName?.trim()) {
        errors.push('Tên khách hàng bắt buộc');
    }
    
    if (!order.customerPhone?.trim()) {
        errors.push('Số điện thoại bắt buộc');
    } else if (!validatePhone(order.customerPhone)) {
        errors.push('Số điện thoại không hợp lệ');
    }
    
    if (!order.shippingAddress?.trim()) {
        errors.push('Địa chỉ bắt buộc');
    }
    
    if (!order.items?.length) {
        errors.push('Phải có ít nhất 1 sản phẩm');
    }
    
    return { valid: errors.length === 0, errors };
}
