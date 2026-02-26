
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
      // Preserve Facebook info from original order (when created from Inbox)
      facebookUserId: order?.facebookUserId,
      facebookUserName: order?.facebookUserName,
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
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
          Thông tin khách hàng
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative md:col-span-2" ref={searchRef}>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tìm khách hàng cũ</label>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={handleCustomerSearch}
                placeholder="Nhập tên hoặc SĐT để tìm nhanh..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm outline-none"
              />
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {customerResults.length > 0 && (
              <ul className="absolute z-[60] w-full bg-white border border-border rounded-2xl mt-2 max-h-56 overflow-y-auto shadow-soft-lg animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                {customerResults.map(c => (
                  <li key={c.id} onClick={() => handleCustomerSelect(c)} className="p-4 hover:bg-primary/5 hover:text-primary cursor-pointer transition-all border-b border-border/30 last:border-0 flex flex-col">
                    <span className="font-bold text-[14px]">{c.name}</span>
                    <span className="text-[12px] opacity-70">{c.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tên người nhận *</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Số điện thoại *</label>
            <input
              type="text"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Địa chỉ giao hàng</label>
            <input
              type="text"
              value={shippingAddress}
              onChange={e => setShippingAddress(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
          Chi tiết đơn hàng
        </h3>
        <div className="space-y-4">
          {items.map((item, index) => {
            const selectedProduct = products.find(p => p.id === item.productId);
            const selectedVariant = selectedProduct?.variants.find(v => v.id === item.variantId);

            return (
              <div key={index} className="grid grid-cols-12 gap-4 p-5 bg-white rounded-2xl border border-border/50 items-center shadow-soft-sm group hover:border-primary/20 transition-all animate-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="col-span-12 sm:col-span-5">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Sản phẩm</label>
                  <select
                    value={item.productId}
                    onChange={e => handleItemChange(index, 'productId', e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
                  >
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Phân loại</label>
                  <select
                    value={item.variantId}
                    onChange={e => handleItemChange(index, 'variantId', e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
                  >
                    {selectedProduct?.variants.map(v => <option key={v.id} value={v.id}>{v.size} - {v.color}</option>)}
                  </select>
                  {selectedVariant && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedVariant.stock <= selectedVariant.lowStockThreshold ? 'bg-status-warning animate-pulse' : 'bg-status-success'}`}></div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${getStockStatusColor(selectedVariant)}`}>
                        Kho: {selectedVariant.stock} (Sẵn có)
                      </p>
                    </div>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Số lượng</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                    min="1"
                    className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-center outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end pt-5 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="w-9 h-9 flex items-center justify-center text-accent-pink bg-accent-pink/5 hover:bg-accent-pink hover:text-white rounded-xl transition-all active:scale-90"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          className="mt-6 flex items-center gap-2 text-[13px] font-black text-primary hover:text-primary-dark transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
            <PlusIcon className="w-4 h-4" />
          </div>
          <span>Thêm sản phẩm mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
        <div>
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent-pink rounded-full"></div>
            Mã giảm giá
          </h3>
          <div className="card-base p-6">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="NHẬP MÃ TẠI ĐÂY"
                className="flex-1 px-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-white transition-all text-[15px] font-black uppercase tracking-widest outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                className="px-6 py-3.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all font-black text-[13px] shadow-soft-sm active:scale-95"
              >
                Áp dụng
              </button>
            </div>
            {voucherError && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{voucherError}</p>}
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-status-info rounded-full"></div>
            Phương thức thanh toán
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div
              onClick={() => setPaymentMethod('cod')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-between ${paymentMethod === 'cod' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'border-border bg-white hover:border-primary/30'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${paymentMethod === 'cod' ? 'bg-primary text-white shadow-soft-sm' : 'bg-muted text-muted-foreground'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-[14px] font-black ${paymentMethod === 'cod' ? 'text-primary' : 'text-foreground'}`}>Thanh toán khi nhận (COD)</p>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tiền mặt • Thanh toán sau</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'cod' ? 'border-primary bg-primary' : 'border-border'}`}>
                {paymentMethod === 'cod' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
            </div>

            <div
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-between ${paymentMethod === 'bank_transfer' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'border-border bg-white hover:border-primary/30'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${paymentMethod === 'bank_transfer' ? 'bg-primary text-white shadow-soft-sm' : 'bg-muted text-muted-foreground'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-[14px] font-black ${paymentMethod === 'bank_transfer' ? 'text-primary' : 'text-foreground'}`}>Chuyển khoản (CK)</p>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">QR Code • App Ngân hàng</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'bank_transfer' ? 'border-primary bg-primary' : 'border-border'}`}>
                {paymentMethod === 'bank_transfer' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-top-4 duration-500 delay-200">
        <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px]">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Ghi chú</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="w-full p-5 bg-white border border-border rounded-2xl text-[14px] outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none leading-relaxed placeholder:text-muted-foreground/30"
            placeholder="Ví dụ: Giao hàng giờ hành chính, gọi điện trước khi giao..."
          />
        </div>

        <div className="p-8 bg-muted/20 border-2 border-primary/20 rounded-[32px] shadow-soft relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <h3 className="text-[13px] font-black text-primary uppercase tracking-[0.2em] mb-6 relative z-10">Tổng cộng đơn hàng</h3>
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center text-[14px] text-muted-foreground font-medium">
              <span>Tạm tính</span>
              <span className="font-bold text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between items-center text-[14px] text-status-success font-bold">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.265 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Giảm giá ({voucherCode})
                </span>
                <span>- {formatCurrency(appliedDiscount)}</span>
              </div>
            )}
            {paymentFee > 0 && (
              <div className="flex justify-between items-center text-[14px] text-muted-foreground font-medium">
                <span>Phí dịch vụ</span>
                <span className="font-bold text-foreground">{formatCurrency(paymentFee)}</span>
              </div>
            )}
            <div className="pt-6 border-t border-primary/10 mt-2">
              <div className="flex justify-between items-end">
                <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest pb-1">Thành tiền</span>
                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-8 border-t border-border/30">
        <button
          type="button"
          onClick={onClose}
          className="px-8 py-4 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-black text-[14px] transition-all active:scale-95"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          className="px-10 py-4 bg-primary text-white rounded-2xl hover:bg-primary-dark font-black text-[15px] shadow-soft-lg transition-all active:scale-95"
        >
          Lưu & Hoàn tất đơn hàng
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
