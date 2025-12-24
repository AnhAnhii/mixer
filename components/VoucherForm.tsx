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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã giảm giá*</label>
          <div className="flex">
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md" required />
            <button type="button" onClick={generateRandomCode} className="px-3 bg-gray-200 border-t border-b border-r border-gray-300 text-sm hover:bg-gray-300 rounded-r-md">Ngẫu nhiên</button>
          </div>
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
            <select value={isActive ? 'true' : 'false'} onChange={e => setIsActive(e.target.value === 'true')} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="true">Đang hoạt động</option>
                <option value="false">Không hoạt động</option>
            </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại giảm giá</label>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')} className="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="fixed">Giảm giá cố định (VND)</option>
            <option value="percentage">Giảm theo phần trăm (%)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị giảm*</label>
          <input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
          {errors.discountValue && <p className="text-red-500 text-xs mt-1">{errors.discountValue}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị đơn hàng tối thiểu (VND)</label>
          <input type="number" value={minOrderValue} onChange={(e) => setMinOrderValue(Number(e.target.value))} min="0" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
           <p className="text-xs text-gray-500 mt-1">Để trống hoặc 0 nếu không áp dụng.</p>
           {errors.minOrderValue && <p className="text-red-500 text-xs mt-1">{errors.minOrderValue}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700">Lưu</button>
      </div>
    </form>
  );
};

export default VoucherForm;