import React, { useState, useEffect } from 'react';
import type { Customer } from '../types';

interface CustomerFormProps {
  onSave: (customer: Customer) => void;
  onClose: () => void;
  customer: Customer | null;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ onSave, onClose, customer }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setTags(customer.tags || []);
    } else {
      // Reset form for new customer
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTags([]);
    }
    setTagInput('');
  }, [customer]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Tên khách hàng không được để trống.';
    if (!phone.trim()) {
      newErrors.phone = 'Số điện thoại không được để trống.';
    } else if (!/^\d{10,11}$/.test(phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ.';
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email không hợp lệ.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      id: customer?.id || crypto.randomUUID(),
      createdAt: customer?.createdAt || new Date().toISOString(),
      name,
      phone,
      email,
      address,
      tags
    });
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
          Thông tin khách hàng
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="customerName" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Tên khách hàng *</label>
            <input
              type="text"
              id="customerName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none"
            />
            {errors.name && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Số điện thoại *</label>
            <input
              type="tel"
              id="customerPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xx xxx xxx"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none"
            />
            {errors.phone && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.phone}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="customerEmail" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Email</label>
            <input
              type="email"
              id="customerEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none"
            />
            {errors.email && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.email}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="customerAddress" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Địa chỉ</label>
            <input
              type="text"
              id="customerAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, tên đường, quận/huyện..."
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="customerTags" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Nhãn khách hàng</label>
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-border rounded-xl focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/50 transition-all min-h-[50px]">
              {tags.map(tag => (
                <div key={tag} className="flex items-center gap-1.5 bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/20 transition-all group">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-primary/40 hover:text-accent-pink transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <input
                type="text"
                id="customerTags"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                className="flex-grow bg-transparent outline-none p-1 text-sm font-bold placeholder:text-muted-foreground/30 placeholder:font-normal"
                placeholder="Thêm nhãn (Enter để lưu)..."
              />
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
          Lưu khách hàng
        </button>
      </div>
    </form>
  );
};

export default CustomerForm;