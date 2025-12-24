import React, { useState, useMemo } from 'react';
import type { Order, Product, ReturnRequest, ReturnRequestItem, ReturnReason } from '../types';
import { ReturnRequestStatus } from '../types';
import Modal from './Modal';
import { useToast } from './Toast';

interface ReturnRequestModalProps {
  order: Order | null;
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onCreateRequest: (request: ReturnRequest) => void;
}

const reasonLabels: Record<ReturnReason, string> = {
    'SIZE_KHONG_VUA': 'Size không vừa',
    'SAN_PHAM_LOI': 'Sản phẩm lỗi',
    'KHONG_GIONG_MO_TA': 'Không giống mô tả',
    'KHONG_THICH': 'Không thích',
    'LY_DO_KHAC': 'Lý do khác',
};

const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({ order, products, isOpen, onClose, onCreateRequest }) => {
  // FIX: Changed state type to ReturnRequestItem[] to correctly include originalOrderItem
  const [requestItems, setRequestItems] = useState<ReturnRequestItem[]>([]);
  const toast = useToast();

  React.useEffect(() => {
      if (isOpen) {
          setRequestItems([]);
      }
  }, [isOpen]);

  const handleItemToggle = (orderItem: Order['items'][0]) => {
    setRequestItems(prev => {
        const existingIndex = prev.findIndex(item => item.originalOrderItem.variantId === orderItem.variantId);
        if (existingIndex > -1) {
            return prev.filter((_, index) => index !== existingIndex);
        } else {
            return [...prev, {
                originalOrderItem: orderItem,
                quantity: orderItem.quantity, // Default to full quantity
                action: 'return',
                reason: 'LY_DO_KHAC'
            }];
        }
    });
  };

  const handleItemChange = <K extends keyof ReturnRequestItem>(index: number, field: K, value: ReturnRequestItem[K]) => {
      setRequestItems(prev => {
          const newItems = [...prev];
          const item = {...newItems[index]};
          (item as any)[field] = value;
          
          // Reset newVariantId if action is changed back to return
          if (field === 'action' && value === 'return') {
              delete item.newVariantId;
          }
          
          newItems[index] = item;
          return newItems;
      });
  };

  const handleSubmit = () => {
    if (!order || requestItems.length === 0) {
        toast.error('Vui lòng chọn ít nhất một sản phẩm để xử lý.');
        return;
    }
    
    const newRequest: ReturnRequest = {
        id: `RR-${crypto.randomUUID().substring(0, 8)}`,
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        createdAt: new Date().toISOString(),
        // FIX: Use enum member for status
        status: ReturnRequestStatus.Pending,
        // FIX: Simplified items assignment since requestItems now has the correct full type
        items: requestItems
    };
    
    onCreateRequest(newRequest);
  };
  
  if (!isOpen || !order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Xử lý Đổi/Trả cho đơn #${order.id.substring(0, 8)}`}>
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-card-foreground">1. Chọn sản phẩm cần xử lý</h3>
          <div className="space-y-2 mt-2">
            {order.items.map(orderItem => (
              <div key={orderItem.variantId} onClick={() => handleItemToggle(orderItem)} className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${requestItems.some(item => item.originalOrderItem.variantId === orderItem.variantId) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-gray-400'}`}>
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{orderItem.productName} <span className="font-normal text-muted-foreground">x {orderItem.quantity}</span></p>
                    <p className="text-xs text-muted-foreground">{orderItem.size} - {orderItem.color}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requestItems.some(item => item.originalOrderItem.variantId === orderItem.variantId)}
                    readOnly
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {requestItems.length > 0 && (
          <div>
            <h3 className="font-semibold text-card-foreground">2. Chi tiết xử lý</h3>
            <div className="space-y-4 mt-2">
              {requestItems.map((item, index) => {
                const product = products.find(p => p.id === item.originalOrderItem.productId);
                return (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border space-y-4">
                    <p className="font-medium">{item.originalOrderItem.productName} ({item.originalOrderItem.size} - {item.originalOrderItem.color})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Hành động</label>
                            <select value={item.action} onChange={e => handleItemChange(index, 'action', e.target.value as 'return' | 'exchange')} className="w-full mt-1 p-2 border border-input rounded-md text-sm bg-card">
                                <option value="return">Trả hàng</option>
                                <option value="exchange">Đổi hàng</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Lý do</label>
                            <select value={item.reason} onChange={e => handleItemChange(index, 'reason', e.target.value as ReturnReason)} className="w-full mt-1 p-2 border border-input rounded-md text-sm bg-card">
                                {Object.entries(reasonLabels).map(([key, value]) => (
                                    <option key={key} value={key}>{value}</option>
                                ))}
                            </select>
                        </div>
                        {item.action === 'exchange' && (
                             <div>
                                <label className="text-xs font-medium text-muted-foreground">Đổi sang</label>
                                <select value={item.newVariantId || ''} onChange={e => handleItemChange(index, 'newVariantId', e.target.value)} className="w-full mt-1 p-2 border border-input rounded-md text-sm bg-card">
                                    <option value="" disabled>Chọn phiên bản mới</option>
                                    {product?.variants.map(variant => (
                                        <option key={variant.id} value={variant.id} disabled={variant.id === item.originalOrderItem.variantId}>
                                            {variant.size} - {variant.color} (Tồn: {variant.stock})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-muted px-4 py-2">Hủy</button>
          <button type="button" onClick={handleSubmit} className="btn-primary px-6 py-2" disabled={requestItems.length === 0}>Tạo yêu cầu</button>
        </div>
      </div>
    </Modal>
  );
};

export default ReturnRequestModal;
