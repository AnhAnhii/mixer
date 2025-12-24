
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Order, OrderItem, Customer, Product, Voucher, ProductVariant } from '../types';
import { OrderStatus } from '../types';
import { PlusIcon, TrashIcon } from './icons';
import { validateOrderData, sanitizeString } from '../utils/validation';

interface OrderFormProps {
  order: Order | Partial<Order> | null;
  customers: Customer[];
  products: Product[];
  vouchers: Voucher[];
  onSave: (order: Order, customerToSave: Customer) => void;
  onClose: () => void;
}

const BANK_TRANSFER_FEE = 30000;

const OrderForm: React.FC<OrderFormProps> = ({ order, customers, products, vouchers, onSave, onClose }) => {
  // Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);


  // Order State
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer'>('cod');
  const [notes, setNotes] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [voucherError, setVoucherError] = useState('');

  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');
      setCustomerId(order.customerId || '');
      setShippingAddress(order.shippingAddress || '');
      setItems(order.items || []);
      setPaymentMethod(order.paymentMethod || 'cod');
      setNotes(order.notes || '');
      setCustomerSearch(''); // Clear search on pre-fill
      if (order.discount?.code) {
        setVoucherCode(order.discount.code);
        setAppliedDiscount(order.discount.amount);
      }
    } else {
      // Reset form for new order
      setCustomerName('');
      setCustomerPhone('');
      setCustomerId('');
      setShippingAddress('');
      setItems([]);
      setPaymentMethod('cod');
      setNotes('');
      setVoucherCode('');
      setAppliedDiscount(0);
      setVoucherError('');
      setCustomerSearch('');
    }
  }, [order]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const paymentFee = useMemo(() => {
    return paymentMethod === 'bank_transfer' ? BANK_TRANSFER_FEE : 0;
  }, [paymentMethod]);

  const finalTotal = useMemo(() => {
      const totalAfterDiscount = subtotal - appliedDiscount;
      return totalAfterDiscount > 0 ? totalAfterDiscount + paymentFee : paymentFee;
  }, [subtotal, appliedDiscount, paymentFee]);


  const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setCustomerSearch(term);
    if (term) {
      const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(term.toLowerCase()) || 
        c.phone.includes(term)
      ).slice(0, 5);
      setCustomerResults(filtered);
    } else {
      setCustomerResults([]);
    }
  };
  
  const handleCustomerSelect = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setShippingAddress(customer.address || '');
    setCustomerSearch('');
    setCustomerResults([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setCustomerResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const handleAddItem = () => {
    if (products.length === 0) return;
    const firstProduct = products[0];
    const firstVariant = firstProduct.variants[0];
    setItems([...items, {
      productId: firstProduct.id,
      productName: firstProduct.name,
      variantId: firstVariant.id,
      size: firstVariant.size,
      color: firstVariant.color,
      quantity: 1,
      price: firstProduct.price,
      costPrice: firstProduct.costPrice
    }]);
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
            const variant = product.variants[0];
            item.productId = product.id;
            item.productName = product.name;
            item.variantId = variant.id;
            item.size = variant.size;
            item.color = variant.color;
            item.price = product.price;
            item.costPrice = product.costPrice;
        }
    } else if (field === 'variantId') {
        const product = products.find(p => p.id === item.productId);
        const variant = product?.variants.find(v => v.id === value);
        if (variant) {
            item.variantId = variant.id;
            item.size = variant.size;
            item.color = variant.color;
        }
    } else if (field === 'quantity') {
        item.quantity = parseInt(value, 10) || 1;
    }
    newItems[index] = item;
    setItems(newItems);
  };
  
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleApplyVoucher = () => {
      setVoucherError('');
      setAppliedDiscount(0);
      const voucher = vouchers.find(v => v.code.toLowerCase() === voucherCode.toLowerCase() && v.isActive);

      if (!voucher) {
          setVoucherError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
          return;
      }
      if (subtotal < (voucher.minOrderValue || 0)) {
           setVoucherError(`Đơn hàng phải có giá trị tối thiểu ${voucher.minOrderValue?.toLocaleString('vi-VN')}đ.`);
           return;
      }

      let discountAmount = 0;
      if (voucher.discountType === 'fixed') {
          discountAmount = voucher.discountValue;
      } else { // percentage
          discountAmount = (subtotal * voucher.discountValue) / 100;
      }
      setAppliedDiscount(discountAmount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validation
    const validation = validateOrderData({
        customerName,
        customerPhone,
        shippingAddress,
        items
    });

    if (!validation.valid) {
        alert('Lỗi:\n' + validation.errors.join('\n'));
        return;
    }

    // 2. Sanitization
    const safeName = sanitizeString(customerName);
    const safePhone = sanitizeString(customerPhone);
    const safeAddress = sanitizeString(shippingAddress);
    const safeNotes = sanitizeString(notes);
    
    const existingCustomer = customers.find(c => c.phone === safePhone);
    let customerToSave: Customer;

    if (!existingCustomer) {
        customerToSave = {
            id: crypto.randomUUID(),
            name: safeName,
            phone: safePhone,
            address: safeAddress,
            createdAt: new Date().toISOString(),
            tags: ['Khách hàng mới']
        };
    } else {
        customerToSave = {
            ...existingCustomer,
            name: safeName,
            address: safeAddress
        };
    }

    const finalOrder: Order = {
      id: order?.id || crypto.randomUUID().substring(0, 8),
      customerName: customerToSave.name,
      customerPhone: customerToSave.phone,
      customerId: customerToSave.id,
      shippingAddress: safeAddress,
      orderDate: order?.orderDate || new Date().toISOString(),
      items,
      totalAmount: finalTotal,
      status: (order as Order)?.status || OrderStatus.Pending,
      paymentMethod,
      paymentStatus: (order as Order)?.paymentStatus || 'Unpaid',
      notes: safeNotes,
      discount: appliedDiscount > 0 ? { code: voucherCode, amount: appliedDiscount } : undefined,
    };
    
    onSave(finalOrder, customerToSave);
  };

  const getStockStatusColor = (variant: ProductVariant) => {
    if (variant.stock <= 0) return 'text-red-600 font-semibold';
    if (variant.stock <= variant.lowStockThreshold) return 'text-yellow-600 font-semibold';
    return 'text-gray-500';
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-slate-50 rounded-lg border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Thông tin khách hàng</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative md:col-span-2" ref={searchRef}>
                <label className="block text-sm font-medium text-gray-700">Tìm khách hàng cũ</label>
                <input 
                  type="text" 
                  value={customerSearch} 
                  onChange={handleCustomerSearch}
                  placeholder="Nhập tên hoặc SĐT để tìm..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {customerResults.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {customerResults.map(c => (
                      <li key={c.id} onClick={() => handleCustomerSelect(c)} className="p-2 hover:bg-primary hover:text-white cursor-pointer">
                        {c.name} - {c.phone}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Tên người nhận*</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Số điện thoại*</label>
                <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Địa chỉ giao hàng</label>
                <input type="text" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
        </div>
      </div>
      
      <div className="p-4 bg-slate-50 rounded-lg border">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Chi tiết đơn hàng</h3>
        <div className="space-y-3">
            {items.map((item, index) => {
                const selectedProduct = products.find(p => p.id === item.productId);
                const selectedVariant = selectedProduct?.variants.find(v => v.id === item.variantId);

                return (
                    <div key={index} className="grid grid-cols-12 gap-x-3 gap-y-2 p-3 bg-white rounded-md border items-center">
                        <div className="col-span-12 sm:col-span-4">
                            <select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-6 sm:col-span-4">
                           <select value={item.variantId} onChange={e => handleItemChange(index, 'variantId', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm">
                                {selectedProduct?.variants.map(v => <option key={v.id} value={v.id}>{v.size} - {v.color}</option>)}
                           </select>
                           {selectedVariant && (
                                <p className={`text-xs mt-1 ${getStockStatusColor(selectedVariant)}`}>
                                    Tồn: {selectedVariant.stock}
                                </p>
                           )}
                        </div>
                         <div className="col-span-3 sm:col-span-2">
                            <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} min="1" className="w-full p-2 border border-gray-300 rounded-md text-sm" />
                        </div>
                        <div className="col-span-3 sm:col-span-2 flex justify-end">
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100">
                                 <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
        <button type="button" onClick={handleAddItem} className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-indigo-800">
            <PlusIcon className="w-5 h-5" /> Thêm sản phẩm
        </button>
      </div>

       <div className="p-4 bg-slate-50 rounded-lg border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Mã giảm giá</h3>
          <div className="flex items-start gap-2">
            <div className="flex-grow">
              <input 
                type="text" 
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã giảm giá"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
               {voucherError && <p className="text-red-500 text-xs mt-1">{voucherError}</p>}
            </div>
            <button type="button" onClick={handleApplyVoucher} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Áp dụng</button>
          </div>
       </div>
      
      <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phương thức thanh toán</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setPaymentMethod('cod')} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-primary bg-indigo-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}>
                  <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${paymentMethod === 'cod' ? 'border-primary' : 'border-gray-400'}`}>
                          {paymentMethod === 'cod' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                      </div>
                      <div>
                          <p className="font-semibold text-gray-800">Thanh toán khi nhận hàng (COD)</p>
                          <p className="text-sm text-gray-600">Trả tiền mặt trực tiếp cho nhân viên giao hàng.</p>
                      </div>
                  </div>
              </div>
               <div onClick={() => setPaymentMethod('bank_transfer')} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'bank_transfer' ? 'border-primary bg-indigo-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}>
                  <div className="flex items-center">
                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${paymentMethod === 'bank_transfer' ? 'border-primary' : 'border-gray-400'}`}>
                          {paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                      </div>
                      <div>
                          <p className="font-semibold text-gray-800">Chuyển khoản ngân hàng</p>
                          <p className="text-sm text-gray-600">Phí ship 30.000đ. Nhận thông tin sau khi đặt hàng.</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="p-4 bg-slate-50 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Ghi chú</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 rounded-md text-sm" placeholder="Thêm ghi chú cho đơn hàng..."></textarea>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border">
             <h3 className="text-lg font-medium text-gray-900 mb-4">Tổng cộng</h3>
             <div className="space-y-2">
                 <div className="flex justify-between text-gray-600">
                     <span>Tạm tính:</span>
                     <span>{formatCurrency(subtotal)}</span>
                 </div>
                 {appliedDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                         <span>Giảm giá ({voucherCode}):</span>
                         <span>- {formatCurrency(appliedDiscount)}</span>
                     </div>
                 )}
                 {paymentFee > 0 && (
                      <div className="flex justify-between text-gray-600">
                         <span>Phí thanh toán:</span>
                         <span>{formatCurrency(paymentFee)}</span>
                     </div>
                 )}
                 <div className="flex justify-between font-bold text-xl text-gray-800 border-t pt-2 mt-2">
                     <span>Thành tiền:</span>
                     <span className="text-primary">{formatCurrency(finalTotal)}</span>
                 </div>
             </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-4 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
          <button type="submit" className="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700">Lưu đơn hàng</button>
      </div>
    </form>
  );
};

export default OrderForm;
