
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SparklesIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ExclamationTriangleIcon } from './icons';
import type { Product, Order, OrderItem, Customer } from '../types';

interface ParsedConversationData {
    customerName: string | null;
    customerPhone: string | null;
    shippingAddress: string | null;
    items: Array<{
        productName: string;
        size?: string;
        color?: string;
        quantity: number;
        matchedProductId?: string;
        matchedVariantId?: string;
    }>;
    notes: string | null;
    missingInfo: string[];
}

interface ConversationParserProps {
    products: Product[];
    onOrderDataReady: (orderData: Partial<Order>, customerData: Partial<Customer>) => void;
}

const ConversationParser: React.FC<ConversationParserProps> = ({ products, onOrderDataReady }) => {
    const [conversation, setConversation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ParsedConversationData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleParse = async () => {
        if (!conversation.trim()) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            setError("Tính năng này đang được nâng cấp để bảo mật hơn. Vui lòng sử dụng AI trích xuất trong Messenger.");
            setIsLoading(false);
            return;
            /*
                        const ai = new GoogleGenAI({ apiKey: 'PROXY' });
            
                        const productList = products.map(p => ({
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            variants: p.variants.map(v => ({
                                id: v.id,
                                size: v.size,
                                color: v.color,
                                stock: v.stock
                            }))
                        }));
            
                        const prompt = `
            Bạn là AI trợ lý bán hàng thời trang. Phân tích cuộc hội thoại Messenger/Zalo sau đây và trích xuất thông tin đặt hàng.
            
            CUỘC HỘI THOẠI:
            """
            ${conversation}
            """
            
            DANH SÁCH SẢN PHẨM CÓ SẴN:
            ${JSON.stringify(productList, null, 2)}
            
            YÊU CẦU:
            1. Trích xuất: Tên khách, SĐT, địa chỉ, sản phẩm muốn mua (tên, size, màu, số lượng), ghi chú
            2. Khớp sản phẩm khách nói với danh sách có sẵn (nếu có thể)
            3. Liệt kê những thông tin còn THIẾU cần hỏi thêm
            
            Trả về JSON với cấu trúc:
            {
              "customerName": string | null,
              "customerPhone": string | null,
              "shippingAddress": string | null,
              "items": [
                {
                  "productName": string,
                  "size": string | null,
                  "color": string | null,
                  "quantity": number,
                  "matchedProductId": string | null,
                  "matchedVariantId": string | null
                }
              ],
              "notes": string | null,
              "missingInfo": ["Thiếu size", "Thiếu địa chỉ", ...]
            }
            `;
            
                        const response = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: prompt,
                            config: {
                                responseMimeType: "application/json",
                            }
                        });
            
                        const parsed = JSON.parse(response.text || '{}') as ParsedConversationData;
                        setResult(parsed);
            */

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Lỗi không xác định');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateOrder = () => {
        if (!result) return;

        // Build order items from parsed data
        const orderItems: OrderItem[] = [];

        for (const item of result.items) {
            if (item.matchedProductId && item.matchedVariantId) {
                const product = products.find(p => p.id === item.matchedProductId);
                const variant = product?.variants.find(v => v.id === item.matchedVariantId);

                if (product && variant) {
                    orderItems.push({
                        productId: product.id,
                        productName: product.name,
                        variantId: variant.id,
                        size: variant.size,
                        color: variant.color,
                        quantity: item.quantity,
                        price: product.price,
                        costPrice: product.costPrice
                    });
                }
            }
        }

        const orderData: Partial<Order> = {
            customerName: result.customerName || '',
            customerPhone: result.customerPhone || '',
            shippingAddress: result.shippingAddress || '',
            items: orderItems,
            notes: result.notes || '',
            paymentMethod: 'cod'
        };

        const customerData: Partial<Customer> = {
            name: result.customerName || '',
            phone: result.customerPhone || '',
            address: result.shippingAddress || ''
        };

        onOrderDataReady(orderData, customerData);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
                <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
                <h3 className="font-semibold">Trích xuất đơn từ cuộc hội thoại</h3>
            </div>

            <p className="text-sm text-muted-foreground">
                Dán cuộc hội thoại từ Messenger/Zalo vào đây, AI sẽ tự động trích xuất thông tin đơn hàng.
            </p>

            <textarea
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                rows={8}
                placeholder={`Ví dụ:
Khách: Cho mình hỏi áo thun trắng size M còn không ạ?
Shop: Dạ còn ạ, bên em giá 250k ạ
Khách: Ok mình lấy 2 cái nhé
Shop: Dạ chị cho em xin thông tin giao hàng ạ
Khách: Nguyễn Thị An, 0901234567, 123 Nguyễn Huệ Q1`}
                className="w-full p-3 border border-input rounded-lg bg-card text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
            />

            <button
                onClick={handleParse}
                disabled={isLoading || !conversation.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
                {isLoading ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Đang phân tích...</span>
                    </>
                ) : (
                    <>
                        <SparklesIcon className="w-5 h-5" />
                        <span>Trích xuất thông tin</span>
                    </>
                )}
            </button>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
            )}

            {result && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border animate-fade-in">
                    <h4 className="font-semibold text-card-foreground flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        Thông tin trích xuất
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Tên khách:</span>
                            <p className="font-medium">{result.customerName || <span className="text-yellow-600">Chưa có</span>}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">SĐT:</span>
                            <p className="font-medium">{result.customerPhone || <span className="text-yellow-600">Chưa có</span>}</p>
                        </div>
                        <div className="md:col-span-2">
                            <span className="text-muted-foreground">Địa chỉ:</span>
                            <p className="font-medium">{result.shippingAddress || <span className="text-yellow-600">Chưa có</span>}</p>
                        </div>
                    </div>

                    {result.items.length > 0 && (
                        <div>
                            <span className="text-muted-foreground text-sm">Sản phẩm:</span>
                            <ul className="mt-1 space-y-1">
                                {result.items.map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm">
                                        <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                                            {item.quantity}
                                        </span>
                                        <span className="font-medium">{item.productName}</span>
                                        {item.size && <span className="text-muted-foreground">- Size {item.size}</span>}
                                        {item.color && <span className="text-muted-foreground">- {item.color}</span>}
                                        {item.matchedProductId && (
                                            <span className="text-green-600 text-xs">✓ Đã khớp</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {result.notes && (
                        <div>
                            <span className="text-muted-foreground text-sm">Ghi chú:</span>
                            <p className="text-sm italic">"{result.notes}"</p>
                        </div>
                    )}

                    {result.missingInfo.length > 0 && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span className="font-medium text-sm">Thông tin còn thiếu:</span>
                            </div>
                            <ul className="mt-1 text-sm text-yellow-600 dark:text-yellow-300 list-disc list-inside">
                                {result.missingInfo.map((info, idx) => (
                                    <li key={idx}>{info}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={handleCreateOrder}
                        className="w-full py-2.5 bg-secondary text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                    >
                        Tạo đơn hàng từ thông tin này
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConversationParser;
