import React from 'react';
import type { ReturnRequest } from '../types';
import { ReturnRequestStatus } from '../types';
import { ArrowUturnLeftIcon, EyeIcon } from './icons';

interface ReturnsPageProps {
  returnRequests: ReturnRequest[];
  onUpdateStatus: (requestId: string, status: ReturnRequestStatus) => void;
  onViewDetails: (request: ReturnRequest) => void;
}

const ReturnsPage: React.FC<ReturnsPageProps> = ({ returnRequests, onUpdateStatus, onViewDetails }) => {

  const getStatusColor = (status: ReturnRequestStatus) => {
    const colors = {
      [ReturnRequestStatus.Pending]: 'bg-yellow-100 text-yellow-800',
      [ReturnRequestStatus.Processing]: 'bg-purple-100 text-purple-800',
      [ReturnRequestStatus.Received]: 'bg-blue-100 text-blue-800',
      [ReturnRequestStatus.Completed]: 'bg-green-100 text-green-800',
      [ReturnRequestStatus.Cancelled]: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const sortedRequests = [...returnRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Quản lý Đổi/Trả hàng</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi và xử lý các yêu cầu đổi trả từ khách hàng.
        </p>
      </div>

      {sortedRequests.length === 0 ? (
        <div className="text-center py-16 card-base border border-dashed flex flex-col items-center">
          <ArrowUturnLeftIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg font-semibold">Chưa có yêu cầu đổi/trả nào.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Mã YC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Đơn hàng gốc</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Khách hàng</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ngày tạo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Trạng thái</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sortedRequests.map(req => (
                  <tr key={req.id} className="hover:bg-muted">
                    <td className="px-4 py-4 font-mono text-sm text-primary">#{req.id.substring(0, 8)}</td>
                    <td className="px-4 py-4 font-mono text-sm text-muted-foreground">#{req.orderId.substring(0, 8)}</td>
                    <td className="px-4 py-4 text-sm font-medium">{req.customerName}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                         <select
                            value={req.status}
                            onChange={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(req.id, e.target.value as ReturnRequestStatus);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border-2 border-transparent focus:border-primary focus:ring-0 appearance-none ${getStatusColor(req.status)}`}
                        >
                              {Object.values(ReturnRequestStatus).map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </td>
                    <td className="px-4 py-4 text-center">
                        <button 
                            onClick={() => onViewDetails(req)}
                            className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50" 
                            title="Xem chi tiết và xử lý"
                        >
                            <EyeIcon className="w-5 h-5"/>
                        </button>
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

export default ReturnsPage;