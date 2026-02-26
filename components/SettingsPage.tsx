
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
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-2xl font-black font-heading text-card-foreground tracking-tight">Cài đặt Hệ thống</h2>
          <p className="text-sm text-muted-foreground mt-1">Cấu hình giao diện, thanh toán và đồng bộ dữ liệu.</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto space-y-12">

        {/* Theme Section */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-75">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
            Giao diện & Chủ đề
          </h3>
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px] space-y-8">
            {/* Palette */}
            <div>
              <label className="text-[12px] font-black text-foreground uppercase tracking-wider mb-4 block opacity-60">Bảng màu hệ thống</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {['modern', 'elegant', 'classic', 'glass'].map(p => (
                  <div
                    key={p}
                    onClick={() => setTheme({ ...theme, palette: p as any })}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 capitalize flex flex-col gap-2 group shadow-soft-sm ${theme.palette === p ? 'border-primary bg-white ring-8 ring-primary/5' : 'border-border bg-white/50 hover:border-primary/30 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[14px] font-black ${theme.palette === p ? 'text-primary' : 'text-foreground/70'}`}>{p}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${theme.palette === p ? 'border-primary bg-primary shadow-sm shadow-primary/40' : 'border-border'}`}>
                        {theme.palette === p && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-border/50">
              {/* Density */}
              <div>
                <label className="text-[12px] font-black text-foreground uppercase tracking-wider mb-4 block opacity-60">Mật độ hiển thị</label>
                <div className="flex gap-3">
                  {['comfortable', 'compact'].map(d => (
                    <button
                      key={d}
                      onClick={() => setTheme({ ...theme, density: d as any })}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all duration-300 font-black text-[13px] uppercase tracking-wider ${theme.density === d ? 'border-primary bg-primary text-white shadow-soft-lg' : 'border-border bg-white/50 text-muted-foreground hover:border-primary/30'}`}
                    >
                      {d === 'comfortable' ? 'Thoải mái' : 'Gọn gàng'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="text-[12px] font-black text-foreground uppercase tracking-wider mb-4 block opacity-60">Kiểu bo góc</label>
                <div className="flex gap-3">
                  {['rounded', 'sharp'].map(s => (
                    <button
                      key={s}
                      onClick={() => setTheme({ ...theme, style: s as any })}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all duration-300 font-black text-[13px] uppercase tracking-wider ${theme.style === s ? 'border-primary bg-primary text-white shadow-soft-lg' : 'border-border bg-white/50 text-muted-foreground hover:border-primary/30'}`}
                    >
                      {s === 'rounded' ? 'Bo tròn' : 'Vuông vắn'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Info Section */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-150">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
            Thông tin Ngân hàng
          </h3>
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px]">
            {bankInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-border/50 shadow-soft-sm group hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 mb-1">Ngân hàng</p>
                  <p className="text-[15px] font-black text-foreground group-hover:text-primary transition-colors">{getBankName(bankInfo.bin)}</p>
                </div>
                <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-border/50 shadow-soft-sm group hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 mb-1">Số tài khoản</p>
                  <p className="text-[16px] font-black text-primary font-mono tracking-tighter">{bankInfo.accountNumber}</p>
                </div>
                <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-border/50 shadow-soft-sm group hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 mb-1">Chủ tài khoản</p>
                  <p className="text-[15px] font-black text-foreground group-hover:text-primary transition-colors">{bankInfo.accountName}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-white/40 rounded-2xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center grayscale opacity-40">
                <svg className="w-8 h-8 mb-2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-[13px] font-bold">Chưa cấu hình tài khoản</p>
              </div>
            )}
          </div>
        </div>

        {/* Backup Section */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-[225ms]">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent-pink rounded-full"></div>
            An toàn dữ liệu
          </h3>
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px]">
            <p className="text-[14px] font-bold text-muted-foreground opacity-60 mb-8 leading-relaxed max-w-2xl px-1">
              Khuyến khích bạn sao lưu dữ liệu hệ thống định kỳ. File xuất ra có thể dùng để khôi phục toàn bộ đơn hàng, sản phẩm và khách hàng bất cứ lúc nào.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-3 px-6 py-5 bg-white border border-border rounded-[20px] font-black text-[14px] uppercase tracking-wider hover:bg-primary hover:text-white hover:border-primary transition-all shadow-soft-sm active:scale-95 group">
                <ArrowDownTrayIcon className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                Xuất file lưu trữ
              </button>
              <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-3 px-6 py-5 bg-white border border-border rounded-[20px] font-black text-[14px] uppercase tracking-wider hover:bg-secondary hover:text-white hover:border-secondary transition-all shadow-soft-sm active:scale-95 group">
                <ArrowUpTrayIcon className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                Khôi phục từ file
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>
        </div>

        {/* Google Sheets Section */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-[300ms]">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#34A853] rounded-full"></div>
            Hợp tác & Đồng bộ
          </h3>
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px] space-y-8">
            <p className="text-[14px] font-bold text-muted-foreground opacity-60 leading-relaxed max-w-2xl px-1">
              Tự động đẩy dữ liệu đơn hàng sang Google Sheets để in ấn, báo cáo hoặc chia sẻ với bên quản lý kho một cách minh bạch, tức thời.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                  Google Apps Script URL
                </label>
                <input
                  type="text"
                  value={googleScriptUrl}
                  onChange={(e) => setGoogleScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/..."
                  className="w-full px-5 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[14px] font-bold outline-none shadow-soft-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                  Tên Sheet mục tiêu
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Ví dụ: Thang02_2025"
                  className="w-full px-5 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[14px] font-bold outline-none shadow-soft-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-8">
              <button
                onClick={handleSaveGoogleSheetsSettings}
                disabled={isSaving || !sheetName.trim()}
                className="w-full sm:w-auto px-12 py-4.5 bg-primary text-white hover:bg-primary-dark rounded-2xl font-black text-[15px] shadow-soft-lg active:scale-95 disabled:opacity-50 transition-all border-b-4 border-primary-dark/30"
              >
                {isSaving ? 'Đang kích hoạt...' : 'Kích hoạt đồng bộ'}
              </button>

              <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-border/50 shadow-soft-sm">
                <div className="w-5 h-5 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black border border-border/50">?</div>
                Hướng dẫn: <code className="text-primary font-black ml-1">script_setup.js</code>
              </div>
            </div>

            {googleScriptUrl && sheetName && (
              <div className="p-5 bg-white border border-status-success/20 rounded-2xl flex items-center justify-between shadow-soft-sm animate-in zoom-in-95 duration-700">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-status-success/10 flex items-center justify-center text-status-success">
                    <div className="w-3 h-3 bg-status-success rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest opacity-50 leading-none mb-1">Trạng thái kết nối</p>
                    <p className="text-[14px] font-black text-status-success">Đang trực tuyến: {sheetName}</p>
                  </div>
                </div>
                <div className="w-1.5 h-1.5 bg-status-success rounded-full"></div>
              </div>
            )}
          </div>
        </div>

        {/* Storage Info */}
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-[375ms] pb-12">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-status-info rounded-full"></div>
            Hạ tầng lưu trữ
          </h3>
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px]">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-status-success shadow-soft-sm border border-status-success/20">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div>
                <p className="text-[18px] font-black text-foreground mb-1 tracking-tight">Supabase Cloud Database</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 bg-status-success rounded-full animate-pulse shadow-[0_0_5px_rgba(80,184,131,0.8)]"></div>
                  <p className="text-[12px] text-muted-foreground font-bold uppercase tracking-widest">Real-time Connection: Stable</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
