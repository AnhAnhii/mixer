import React, { useState, useEffect } from 'react';
import type { Voucher } from '../types';

interface VoucherFormProps {
  onSave: (voucher: Voucher) => void;
  onClose: () => void;
  voucher: Voucher | null;
}

const VoucherForm: React.FC<VoucherFormProps> = ({ onSave, onClose, voucher }) => {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (voucher) {
      setCode(voucher.code);
      setDiscountType(voucher.discountType);
      setDiscountValue(voucher.discountValue);
      setMinOrderValue(voucher.minOrderValue || 0);
      setIsActive(voucher.isActive);
    } else {
      // Reset form
      setCode('');
      setDiscountType('fixed');
      setDiscountValue(0);
      setMinOrderValue(0);
      setIsActive(true);
    }
  }, [voucher]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!code.trim()) newErrors.code = 'Mã giảm giá không được để trống.';
    if (discountValue <= 0) newErrors.discountValue = 'Giá trị giảm giá phải lớn hơn 0.';
    if (discountType === 'percentage' && discountValue > 100) newErrors.discountValue = 'Giá trị % không được lớn hơn 100.';
    if (minOrderValue < 0) newErrors.minOrderValue = 'Giá trị không hợp lệ.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      id: voucher?.id || crypto.randomUUID(),
      code: code.toUpperCase().trim(),
      discountType,
      discountValue,
      minOrderValue: minOrderValue > 0 ? minOrderValue : undefined,
      isActive,
      usageCount: voucher?.usageCount || 0,
    });
  };

  const generateRandomCode = () => {
    const randomCode = `SALE${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setCode(randomCode);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
          Cấu hình mã giảm giá
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Mã giảm giá *</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VÍ DỤ: WINTER2026"
                className="w-full pl-4 pr-32 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-black uppercase tracking-widest outline-none"
                required
              />
              <button
                type="button"
                onClick={generateRandomCode}
                className="absolute right-2 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all text-[10px] font-black uppercase tracking-wider rounded-lg border border-border/50"
              >
                Ngẫu nhiên
              </button>
            </div>
            {errors.code && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.code}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Trạng thái</label>
            <select
              value={isActive ? 'true' : 'false'}
              onChange={e => setIsActive(e.target.value === 'true')}
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Tạm dừng</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Loại giảm giá</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
            >
              <option value="fixed">Giảm tiền mặt (VND)</option>
              <option value="percentage">Giảm phần trăm (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Giá trị giảm *</label>
            <div className="relative">
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min="0"
                className="w-full pl-4 pr-12 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none font-sans"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40 uppercase">
                {discountType === 'percentage' ? '%' : 'VND'}
              </span>
            </div>
            {errors.discountValue && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.discountValue}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Đơn hàng tối thiểu (VND)</label>
            <input
              type="number"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(Number(e.target.value))}
              min="0"
              placeholder="0"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none font-sans"
            />
            {errors.minOrderValue && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.minOrderValue}</p>}
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
          Lưu cấu hình
        </button>
      </div>
    </form>
  );
};

export default VoucherForm;