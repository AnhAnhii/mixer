
import React, { useState, useMemo } from 'react';
import type { Customer } from '../types';
import { PencilIcon, TrashIcon, PlusIcon, EyeIcon } from './icons';

interface CustomerListProps {
  customers: Customer[];
  onViewDetails: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onAddCustomer: () => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, onViewDetails, onEdit, onDelete, onAddCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(customer => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          customer.name.toLowerCase().includes(lowerSearchTerm) ||
          customer.phone.includes(searchTerm) ||
          customer.email?.toLowerCase().includes(lowerSearchTerm)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b-2 border-border pb-4">
        <h2 className="text-2xl font-black font-heading text-card-foreground">Quản lý Khách hàng 👥</h2>
        <button onClick={onAddCustomer} className="btn-primary flex items-center gap-2 px-4 py-2">
          <PlusIcon className="w-5 h-5" /> Thêm khách hàng
        </button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, SĐT, hoặc email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/2 lg:w-1/3 pl-4 pr-4 py-2 border-2 border-border rounded-lg focus:shadow-[2px_2px_0px_var(--color-border)] focus:outline-none bg-card font-body"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-lg font-semibold">Không tìm thấy khách hàng nào.</p>
          <p className="text-muted-foreground/70 mt-2">Nhấn "Thêm khách hàng" để bắt đầu.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg overflow-hidden border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50 border-b-2 border-border">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Tên khách hàng</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Liên hệ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Ngày tham gia</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-card-foreground">{customer.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <p>{customer.phone}</p>
                      {customer.email && <p className="text-xs">{customer.email}</p>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onViewDetails(customer)} className="text-accent-blue hover:bg-accent-blue/10 p-2 rounded-lg border-2 border-transparent hover:border-accent-blue transition-all" title="Xem">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onEdit(customer)} className="text-primary hover:bg-primary/10 p-2 rounded-lg border-2 border-transparent hover:border-border transition-all" title="Sửa">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(customer.id)} className="text-accent-pink hover:bg-accent-pink/10 p-2 rounded-lg border-2 border-transparent hover:border-accent-pink transition-all" title="Xóa">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
