
import React from 'react';
import type { Order, BankInfo } from '../types';

interface InvoicePageProps {
  order: Order;
  bankInfo: BankInfo | null;
  onBack: () => void;
}

const InvoicePage: React.FC<InvoicePageProps> = ({ order, bankInfo, onBack }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };
  
  const handlePrint = () => {
      window.print();
  }

  return (
    <div>
        <div className="mb-6 flex justify-between items-center print:hidden">
            <button onClick={onBack} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">&larr; Quay lại</button>
            <h2 className="text-2xl font-semibold text-gray-700">Hóa đơn chi tiết</h2>
            <button onClick={handlePrint} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-indigo-700">In hóa đơn</button>
        </div>
        
        <div className="bg-white p-8 md:p-12 shadow-lg rounded-lg max-w-4xl mx-auto" id="invoice-content">
            {/* Header */}
            <div className="flex justify-between items-start pb-6 border-b">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">HÓA ĐƠN BÁN HÀNG</h1>
                    <p className="text-gray-500">Mã đơn hàng: #{order.id.substring(0, 8)}</p>
                    <p className="text-gray-500">Ngày đặt: {new Date(order.orderDate).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-semibold text-primary">Cửa Hàng Của Bạn</h2>
                    <p className="text-sm text-gray-600">Địa chỉ của bạn</p>
                    <p className="text-sm text-gray-600">SĐT: 0123 456 789</p>
                </div>
            </div>
            
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-8 py-6">
                <div>
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-2">Thông tin khách hàng</h3>
                    <p className="font-bold text-gray-800">{order.customerName}</p>
                    <p className="text-gray-600">{order.shippingAddress}</p>
                    <p className="text-gray-600">{order.customerPhone}</p>
                </div>
                 <div>
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-2">Thông tin thanh toán</h3>
                    <p className="text-gray-600">
                        <span className="font-medium">Phương thức:</span> 
                        {order.paymentMethod === 'cod' ? ' Thanh toán khi nhận hàng (COD)' : ' Chuyển khoản'}
                    </p>
                     <p className="text-gray-600">
                        <span className="font-medium">Trạng thái:</span> 
                        {order.status}
                    </p>
                </div>
            </div>
            
            {/* Items Table */}
            <div className="overflow-x-auto">
                 <table className="min-w-full">
                  <thead className="border-b-2 border-gray-300">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-600 uppercase">Sản phẩm</th>
                      <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-gray-600 uppercase">SL</th>
                      <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-600 uppercase">Đơn giá</th>
                      <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-600 uppercase">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-4 whitespace-nowrap">
                            <p className="font-medium text-gray-800">{item.productName}</p>
                            <p className="text-sm text-gray-500">{item.size} - {item.color}</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-gray-800">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                   <tfoot>
                        <tr>
                            <td colSpan={2}></td>
                            <td className="px-4 py-4 text-right font-bold text-lg text-gray-800">TỔNG CỘNG</td>
                            <td className="px-4 py-4 text-right font-bold text-lg text-primary">{formatCurrency(order.totalAmount)}</td>
                        </tr>
                   </tfoot>
                </table>
            </div>
            
            {/* Footer */}
            <div className="pt-8 mt-8 border-t text-center text-gray-500 text-sm">
                <p>Cảm ơn quý khách đã mua hàng!</p>
                {bankInfo && order.paymentMethod === 'bank_transfer' && (
                    <div className="mt-4">
                        <h4 className="font-semibold">Thông tin chuyển khoản</h4>
                        <p>Ngân hàng: {bankInfo.bin}</p>
                        <p>STK: {bankInfo.accountNumber}</p>
                        <p>Chủ TK: {bankInfo.accountName}</p>
                        <p>Nội dung: Mixer {order.id.substring(0, 8)}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default InvoicePage;
