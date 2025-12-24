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
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Tên khách hàng*</label>
                <input type="text" id="customerName" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
             <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại*</label>
                <input type="tel" id="customerPhone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
             <div className="md:col-span-2">
                <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="customerEmail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
             <div className="md:col-span-2">
                <label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input type="text" id="customerAddress" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
            </div>
            <div className="md:col-span-2">
                <label htmlFor="customerTags" className="block text-sm font-medium text-gray-700 mb-1">Nhãn khách hàng</label>
                <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md">
                    {tags.map(tag => (
                        <div key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-sm font-medium px-2 py-0.5 rounded-full">
                            <span>{tag}</span>
                            <button type="button" onClick={() => removeTag(tag)} className="text-primary hover:text-indigo-800">&times;</button>
                        </div>
                    ))}
                    <input 
                        type="text" 
                        id="customerTags" 
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagInputKeyDown}
                        className="flex-grow bg-transparent outline-none p-1"
                        placeholder="Thêm nhãn..."
                    />
                </div>
                 <p className="text-xs text-gray-500 mt-1">Nhấn Enter hoặc dấu phẩy (,) để thêm nhãn.</p>
            </div>
        </div>
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Hủy</button>
        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700">Lưu khách hàng</button>
      </div>
    </form>
  );
};

export default CustomerForm;