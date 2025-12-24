
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
    <div>
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Quản lý Khách hàng</h2>
        <button onClick={onAddCustomer} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-indigo-700 transition-colors shadow">
          <PlusIcon className="w-5 h-5" /> Thêm khách hàng
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, SĐT, hoặc email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/2 lg:w-1/3 pl-4 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">Không tìm thấy khách hàng nào.</p>
          <p className="text-gray-400 mt-2">Nhấn "Thêm khách hàng" để bắt đầu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khách hàng</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Liên hệ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tham gia</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <p>{customer.phone}</p>
                        {customer.email && <p className="text-xs">{customer.email}</p>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                         <button onClick={() => onViewDetails(customer)} className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded-full hover:bg-blue-100">
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onEdit(customer)} className="text-primary hover:text-indigo-800 transition-colors p-1 rounded-full hover:bg-indigo-100">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(customer.id)} className="text-red-600 hover:text-red-900 transition-colors p-1 rounded-full hover:bg-red-100">
                          <TrashIcon className="w-5 h-5" />
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
