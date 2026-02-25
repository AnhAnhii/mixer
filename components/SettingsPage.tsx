
import React, { useRef, useState, useEffect } from 'react';
import type { BankInfo, Order, Product, Customer, Voucher, SocialPostConfig, UiMode, ThemeSettings, ActivityLog, AutomationRule, ReturnRequest, User } from '../types';
import { banks } from '../data/banks';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from './icons';
import { useToast } from './Toast';
import { saveGoogleSheetsSettings, loadGoogleSheetsSettings, getStoredGoogleScriptUrl, getStoredSheetName } from '../services/googleSheetsService';

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

  // Google Sheets state
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load Google Sheets settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const config = await loadGoogleSheetsSettings();
      if (config) {
        setGoogleScriptUrl(config.scriptUrl || '');
        setSheetName(config.sheetName || '');
      } else {
        // Fallback to sync getters (from localStorage)
        setGoogleScriptUrl(getStoredGoogleScriptUrl());
        setSheetName(getStoredSheetName());
      }
    };
    loadSettings();
  }, []);

  const handleSaveGoogleSheetsSettings = async () => {
    if (!sheetName.trim()) {
      toast.error('Vui lòng nhập tên sheet');
      return;
    }
    setIsSaving(true);
    const success = await saveGoogleSheetsSettings(googleScriptUrl, sheetName);
    if (success) {
      toast.success('Đã lưu cấu hình Google Sheets vào Supabase!');
    } else {
      toast.success('Đã lưu cấu hình Google Sheets (local)!');
    }
    setIsSaving(false);
  };

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
      <div className="flex justify-between items-center mb-6 border-b-2 border-border pb-4">
        <h2 className="text-2xl font-black font-heading text-card-foreground">⚙️ Cài đặt Hệ thống</h2>
      </div>
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Theme Section */}
        <div>
          <h3 className="text-lg font-bold font-heading text-card-foreground mb-4">Giao diện & Chủ đề</h3>
          <div className="bg-card p-6 rounded-lg border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
            {/* Palette */}
            <div className="mb-6">
              <label className="text-sm font-medium text-muted-foreground mb-3 block">Bảng màu</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['modern', 'elegant', 'classic', 'glass'].map(p => (
                  <div key={p} onClick={() => setTheme({ ...theme, palette: p as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-150 capitalize font-semibold ${theme.palette === p ? 'border-black bg-accent-yellow shadow-[3px_3px_0px_#000] -translate-x-0.5 -translate-y-0.5' : 'border-border hover:border-black hover:shadow-[2px_2px_0px_#000]'}`}>
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
                  <div key={d} onClick={() => setTheme({ ...theme, density: d as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-150 capitalize font-semibold ${theme.density === d ? 'border-black bg-accent-yellow shadow-[3px_3px_0px_#000] -translate-x-0.5 -translate-y-0.5' : 'border-border hover:border-black hover:shadow-[2px_2px_0px_#000]'}`}>
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
                  <div key={s} onClick={() => setTheme({ ...theme, style: s as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-150 capitalize font-semibold ${theme.style === s ? 'border-black bg-accent-yellow shadow-[3px_3px_0px_#000] -translate-x-0.5 -translate-y-0.5' : 'border-border hover:border-black hover:shadow-[2px_2px_0px_#000]'}`}>
                    <p className="font-semibold">{s === 'rounded' ? 'Bo tròn' : 'Vuông vắn'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Info Section */}
        <div>
          <h3 className="text-lg font-bold font-heading text-card-foreground mb-4">Thông tin Ngân hàng</h3>
          <div className="bg-card p-6 rounded-lg border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
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
          <h3 className="text-lg font-bold font-heading text-card-foreground mb-4">Sao lưu & Khôi phục</h3>
          <div className="bg-card p-6 rounded-lg border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
            <p className="text-sm text-muted-foreground mb-4">
              Xuất file JSON để sao lưu hoặc khôi phục dữ liệu từ file đã xuất trước đó.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleExport} className="btn-muted w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold">
                <ArrowDownTrayIcon className="w-5 h-5" />
                Xuất Backup
              </button>
              <button onClick={handleImportClick} className="btn-muted w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold">
                <ArrowUpTrayIcon className="w-5 h-5" />
                Khôi phục từ file
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>
        </div>

        {/* Google Sheets Section */}
        <div>
          <h3 className="text-lg font-bold font-heading text-card-foreground mb-4">Google Sheets Sync</h3>
          <div className="bg-card p-6 rounded-lg border-2 border-border shadow-[4px_4px_0px_var(--color-border)] space-y-4">
            <p className="text-sm text-muted-foreground">
              Tự động đồng bộ đơn hàng sang Google Sheets để nhân viên kho dễ dàng theo dõi.
            </p>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Google Apps Script URL
              </label>
              <input
                type="text"
                value={googleScriptUrl}
                onChange={(e) => setGoogleScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full px-4 py-2 border-2 border-border rounded-lg bg-background text-card-foreground focus:shadow-[2px_2px_0px_var(--color-border)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Tên Sheet (bắt buộc)
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Ví dụ: Thang12, DonHang2024, ..."
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-card-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nhập tên sheet bạn muốn lưu đơn hàng (ví dụ: Thang12)
              </p>
            </div>

            <button
              onClick={handleSaveGoogleSheetsSettings}
              disabled={isSaving || !sheetName.trim()}
              className="btn-primary w-full px-4 py-3 disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>

            <p className="text-xs text-muted-foreground">
              Xem hướng dẫn tại: <code className="bg-muted px-1 rounded">docs/google_sheets_script.js</code>
            </p>

            {googleScriptUrl && sheetName && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Đã cấu hình - Đơn hàng sẽ sync vào sheet "{sheetName}"</span>
              </div>
            )}
          </div>
        </div>

        {/* Storage Info */}
        <div>
          <h3 className="text-lg font-bold font-heading text-card-foreground mb-4">Lưu trữ</h3>
          <div className="bg-card p-6 rounded-lg border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
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
