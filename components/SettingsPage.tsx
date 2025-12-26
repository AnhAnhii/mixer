
import React, { useRef, useState } from 'react';
import type { BankInfo, Order, Product, Customer, Voucher, SocialPostConfig, UiMode, ThemeSettings, ActivityLog, AutomationRule, ReturnRequest, User } from '../types';
import { banks } from '../data/banks';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from './icons';
import { useToast } from './Toast';

interface SettingsPageProps {
  bankInfo: BankInfo | null;
  allData: {
    orders: Order[];
    products: Product[];
    customers: Customer[];
    vouchers: Voucher[];
    bankInfo: BankInfo | null;
    socialConfigs: SocialPostConfig[];
    uiMode: UiMode;
    theme: ThemeSettings;
    activityLog: ActivityLog[];
    automationRules: AutomationRule[];
    returnRequests: ReturnRequest[];
    users: User[];
  };
  onImportData: (data: any) => void;
  theme: ThemeSettings;
  setTheme: (theme: ThemeSettings) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ bankInfo, allData, onImportData, theme, setTheme }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const getBankName = (bin: string | undefined) => {
    if (!bin) return 'Không rõ';
    const bank = banks.find(b => b.bin === bin);
    return bank ? `${bank.shortName} - ${bank.name}` : 'Không rõ';
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mixer_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file backup thành công!');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          onImportData(data);
          toast.success('Đã khôi phục dữ liệu từ file thành công!');
        } catch (error) {
          toast.error('Lỗi: File không hợp lệ.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Cài đặt Hệ thống</h2>
      </div>
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Theme Section */}
        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Giao diện & Chủ đề</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            {/* Palette */}
            <div className="mb-6">
              <label className="text-sm font-medium text-muted-foreground mb-3 block">Bảng màu</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['modern', 'elegant', 'classic', 'glass'].map(p => (
                  <div key={p} onClick={() => setTheme({ ...theme, palette: p as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all capitalize ${theme.palette === p ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-400'}`}>
                    <p className="font-semibold">{p}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Density */}
            <div className="mb-6">
              <label className="text-sm font-medium text-muted-foreground mb-3 block">Mật độ hiển thị</label>
              <div className="grid grid-cols-2 gap-4">
                {['comfortable', 'compact'].map(d => (
                  <div key={d} onClick={() => setTheme({ ...theme, density: d as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all capitalize ${theme.density === d ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-400'}`}>
                    <p className="font-semibold">{d === 'comfortable' ? 'Thoải mái' : 'Gọn gàng'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-3 block">Kiểu góc</label>
              <div className="grid grid-cols-2 gap-4">
                {['rounded', 'sharp'].map(s => (
                  <div key={s} onClick={() => setTheme({ ...theme, style: s as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all capitalize ${theme.style === s ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-400'}`}>
                    <p className="font-semibold">{s === 'rounded' ? 'Bo tròn' : 'Vuông vắn'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Info Section */}
        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Thông tin Ngân hàng</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            {bankInfo ? (
              <div className="space-y-3">
                <p className="text-sm"><span className="font-medium text-muted-foreground">Ngân hàng:</span> <span className="text-card-foreground">{getBankName(bankInfo.bin)}</span></p>
                <p className="text-sm"><span className="font-medium text-muted-foreground">Số tài khoản:</span> <span className="text-card-foreground font-mono">{bankInfo.accountNumber}</span></p>
                <p className="text-sm"><span className="font-medium text-muted-foreground">Chủ tài khoản:</span> <span className="text-card-foreground">{bankInfo.accountName}</span></p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">Chưa có thông tin ngân hàng.</p>
            )}
          </div>
        </div>

        {/* Backup Section */}
        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Sao lưu & Khôi phục (Local)</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Xuất file JSON để sao lưu hoặc khôi phục dữ liệu từ file đã xuất trước đó.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors shadow">
                <ArrowDownTrayIcon className="w-5 h-5" />
                Xuất file Backup JSON
              </button>
              <button onClick={handleImportClick} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors shadow">
                <ArrowUpTrayIcon className="w-5 h-5" />
                Khôi phục từ file
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>
        </div>

        {/* Storage Info */}
        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Lưu trữ</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-card-foreground">Supabase Database</p>
                <p className="text-xs text-muted-foreground">Dữ liệu được lưu trữ an toàn trên đám mây</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
