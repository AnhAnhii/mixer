import React, { useState, useEffect } from 'react';
import type { Order, BankInfo } from '../types';
import Modal from './Modal';
import { CheckCircleIcon } from './icons';

interface VnPayPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  bankInfo: BankInfo | null;
  onSimulateSuccess: () => void;
}

const VnPayPaymentModal: React.FC<VnPayPaymentModalProps> = ({ isOpen, onClose, order, bankInfo, onSimulateSuccess }) => {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes

  useEffect(() => {
    if (!isOpen) return;

    setTimeLeft(15 * 60);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose(); // Auto-close when timer expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onClose]);

  if (!isOpen || !order || !bankInfo) return null;

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="bg-white p-2 rounded-lg">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#005baa] text-white p-3 rounded-t-md">
            <img src="https://vnpay.vn/s1/statics.vnpay.vn/vnpay-website/logo/logo_vnpay_white.svg" alt="VNPAY Logo" className="h-6" />
            <div className="text-right">
                <p className="text-sm">Giao dịch hết hạn sau</p>
                <p className="font-bold text-lg">{minutes}:{seconds}</p>
            </div>
        </div>

        <div className="p-6 space-y-4">
            <h2 className="text-center text-xl font-bold text-gray-800">Quét mã để thanh toán</h2>
            <p className="text-center text-sm text-gray-500">Sử dụng App Ngân hàng hoặc Ví điện tử hỗ trợ VNPAY-QR</p>
            
            <div className="flex justify-center">
                 <img 
                    src={`https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(`TT don hang ${order.id.substring(0, 8)}`)}&accountName=${encodeURIComponent(bankInfo.accountName)}`}
                    alt="VietQR Code"
                    className="w-56 h-56 rounded-md border-4 border-gray-200"
                />
            </div>
            
            <div className="text-sm space-y-2 pt-4 border-t">
                <div className="flex justify-between"><span className="text-gray-500">Mã đơn hàng:</span> <span className="font-semibold text-gray-800">#{order.id.substring(0,8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Nhà cung cấp:</span> <span className="font-semibold text-gray-800">Mixer Store</span></div>
                <div className="flex justify-between text-lg"><span className="text-gray-500">Số tiền:</span> <span className="font-bold text-[#ef282b]">{formatCurrency(order.totalAmount)}</span></div>
            </div>

            <div className="pt-4">
                <button 
                    onClick={onSimulateSuccess}
                    className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                    <CheckCircleIcon className="w-6 h-6" />
                    Mô phỏng Thanh toán Thành công
                </button>
                 <p className="text-xs text-gray-400 mt-2 text-center">Đây là giao diện mô phỏng cho mục đích demo.</p>
            </div>
        </div>
      </div>
    </Modal>
  );
};

export default VnPayPaymentModal;