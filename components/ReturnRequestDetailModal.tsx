import React, { useState, useMemo, useEffect } from 'react';
import type { ReturnRequest, Product, ProductVariant } from '../types';
import { ReturnRequestStatus } from '../types';
import Modal from './Modal';
import { useToast } from './Toast';
import { CheckCircleIcon, TruckIcon } from './icons';

interface ReturnRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ReturnRequest | null;
  products: Product[];
  onUpdateRequest: (updatedRequest: ReturnRequest) => void;
  onUpdateStatus: (requestId: string, status: ReturnRequestStatus) => void;
  onProcessExchange: (requestId: string) => void;
}

const reasonLabels: Record<string, string> = {
    'SIZE_KHONG_VUA': 'Size không vừa',
    'SAN_PHAM_LOI': 'Sản phẩm lỗi',
    'KHONG_GIONG_MO_TA': 'Không giống mô tả',
    'KHONG_THICH': 'Không thích',
    'LY_DO_KHAC': 'Lý do khác',
};

const ReturnRequestDetailModal: React.FC<ReturnRequestDetailModalProps> = ({ isOpen, onClose, request, products, onUpdateRequest, onUpdateStatus, onProcessExchange }) => {
    const [returnTrackingCode, setReturnTrackingCode] = useState('');
    const [shippingFee, setShippingFee] = useState(0);
    const [isCreatingShipping, setIsCreatingShipping] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (request) {
            setReturnTrackingCode(request.returnTrackingCode || '');
            setShippingFee(request.exchangeShippingFee || 0);
            setIsCreatingShipping(false); // Reset loading state when new request is viewed
        }
    }, [request]);
    
    const isExchange = useMemo(() => request?.items.some(i => i.action === 'exchange'), [request]);

    const financialSummary = useMemo(() => {
        if (!request) return null;

        const allProductVariants = products.flatMap(p => p.variants.map(v => ({...v, price: p.price, productName: p.name})));

        const returnedValue = request.items
            .reduce((sum, i) => sum + (i.originalOrderItem.price * i.quantity), 0);
        
        const newItemsValue = request.items
            .filter(i => i.action === 'exchange' && i.newVariantId)
            .reduce((sum, i) => {
                const newVariant = allProductVariants.find(v => v.id === i.newVariantId);
                return sum + (newVariant?.price || 0) * i.quantity;
            }, 0);
        
        const fee = shippingFee || 0;
        const difference = (returnedValue) - (newItemsValue + fee);

        return { returnedValue, newItemsValue, fee, difference };
    }, [request, products, shippingFee]);

    if (!isOpen || !request) return null;

    const getStatusColor = (status: ReturnRequestStatus) => {
        const colors = {
          [ReturnRequestStatus.Pending]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          [ReturnRequestStatus.Processing]: 'bg-purple-100 text-purple-800 border-purple-300',
          [ReturnRequestStatus.Received]: 'bg-blue-100 text-blue-800 border-blue-300',
          [ReturnRequestStatus.Completed]: 'bg-green-100 text-green-800 border-green-300',
          [ReturnRequestStatus.Cancelled]: 'bg-red-100 text-red-800 border-red-300',
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN');

    const handleSaveChanges = () => {
        const updatedRequest = {
            ...request,
            returnTrackingCode: returnTrackingCode,
            exchangeShippingFee: shippingFee
        };
        onUpdateRequest(updatedRequest);
        toast.success('Đã lưu thay đổi!');
    };

    const handleCreateExchangeShipment = () => {
        if(!request) return;
        setIsCreatingShipping(true);
        onProcessExchange(request.id);
    };

    const getNewVariantInfo = (variantId: string): ProductVariant & { productName: string, price: number } | null => {
         for (const product of products) {
            const variant = product.variants.find(v => v.id === variantId);
            if (variant) {
                return { ...variant, productName: product.name, price: product.price };
            }
        }
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Yêu cầu Đổi/Trả #${request.id.substring(0, 8)}`}>
            <div className="space-y-6">
                <div className="p-4 bg-muted rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-4">
                     <div>
                        <p className="text-sm text-muted-foreground">Đơn hàng gốc: <span className="font-semibold text-primary">#{request.orderId.substring(0,8)}</span></p>
                        <p className="text-sm text-muted-foreground">Ngày tạo: <span className="font-semibold">{formatDate(request.createdAt)}</span></p>
                    </div>
                     <span className={`text-sm font-bold px-3 py-1 rounded-full border-2 ${getStatusColor(request.status)}`}>{request.status}</span>
                </div>
                
                <div>
                    <h3 className="font-semibold text-card-foreground mb-2">Sản phẩm xử lý</h3>
                    <div className="space-y-3">
                    {request.items.map((item, index) => {
                        const newVariantInfo = item.newVariantId ? getNewVariantInfo(item.newVariantId) : null;
                        return (
                            <div key={index} className="p-3 bg-card border rounded-md">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium">{item.originalOrderItem.productName}</p>
                                        <p className="text-xs text-muted-foreground">{item.originalOrderItem.size} - {item.originalOrderItem.color} x {item.quantity}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${item.action === 'return' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {item.action === 'return' ? 'Trả hàng' : 'Đổi hàng'}
                                    </span>
                                </div>
                                <p className="text-xs mt-1">Lý do: {reasonLabels[item.reason]}</p>
                                {newVariantInfo && (
                                     <div className="mt-2 pt-2 border-t text-xs">
                                        <p> &rarr; <span className="font-semibold">Đổi sang:</span> {newVariantInfo.productName} ({newVariantInfo.size} - {newVariantInfo.color})</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                        <h3 className="font-semibold text-card-foreground mb-2">Xử lý Vận hành</h3>
                        
                        {isExchange && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Đơn hàng Đổi (Giao & Lấy)</label>
                                {!request.exchangeTrackingCode ? (
                                    <button onClick={handleCreateExchangeShipment} disabled={isCreatingShipping || request.status !== ReturnRequestStatus.Pending} className="btn-secondary px-4 py-2 w-full flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                        <TruckIcon className="w-5 h-5"/>
                                        {isCreatingShipping ? 'Đang tạo...' : 'Tạo đơn hàng đổi'}
                                    </button>
                                ) : (
                                    <div className="p-2 bg-green-100 text-green-800 rounded-md text-center">
                                        <p className="text-xs">Đã tạo đơn:</p>
                                        <p className="font-semibold font-mono">{request.exchangeTrackingCode}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Mã vận đơn khách gửi trả (nếu có)</label>
                            <input type="text" value={returnTrackingCode} onChange={e => setReturnTrackingCode(e.target.value)} className="w-full input-base p-2 border" placeholder="Nhập nếu khách tự gửi..."/>
                        </div>
                    </div>
                    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                         <h3 className="font-semibold text-card-foreground mb-2">Tổng kết tài chính</h3>
                         <div className="space-y-2 mb-4">
                            <label className="text-sm font-medium text-muted-foreground">Phí vận chuyển đổi hàng (shop trả)</label>
                            <input type="number" value={shippingFee} onChange={e => setShippingFee(Number(e.target.value))} className="w-full input-base p-2 border"/>
                        </div>
                         <div className="text-sm space-y-2 pt-4 border-t">
                             <div className="flex justify-between"><span>Giá trị hàng trả/đổi:</span> <span>{formatCurrency(financialSummary?.returnedValue || 0)}</span></div>
                             <div className="flex justify-between"><span>Giá trị hàng đổi mới:</span> <span>- {formatCurrency(financialSummary?.newItemsValue || 0)}</span></div>
                             <div className="flex justify-between"><span>Phí vận chuyển đổi hàng:</span> <span>- {formatCurrency(financialSummary?.fee || 0)}</span></div>
                             <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                                 <span>{financialSummary?.difference && financialSummary.difference >= 0 ? 'Hoàn cho khách:' : 'Thu thêm của khách:'}</span> 
                                 <span className={financialSummary?.difference && financialSummary.difference >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(Math.abs(financialSummary?.difference || 0))}</span>
                             </div>
                         </div>
                    </div>
                </div>

                <div className="flex justify-between items-center gap-4 pt-4 border-t">
                    <button onClick={handleSaveChanges} className="btn-muted px-4 py-2 text-sm">Lưu thay đổi</button>
                    <div className="flex justify-end gap-4">
                        {(request.status === ReturnRequestStatus.Pending || request.status === ReturnRequestStatus.Processing) && (
                            <button onClick={() => onUpdateStatus(request.id, ReturnRequestStatus.Received)} className="btn-secondary px-4 py-2 flex items-center gap-2">
                                <CheckCircleIcon className="w-5 h-5"/> Xác nhận đã nhận hàng
                            </button>
                        )}
                         {request.status === ReturnRequestStatus.Received && (
                            <button onClick={() => onUpdateStatus(request.id, ReturnRequestStatus.Completed)} className="btn-primary px-4 py-2 flex items-center gap-2">
                                Hoàn thành & Đóng yêu cầu
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    )
};

export default ReturnRequestDetailModal;