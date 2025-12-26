
import React, { useRef, useState } from 'react';
import type { BankInfo, Order, Product, Customer, Voucher, SocialPostConfig, UiMode, ThemeSettings, ActivityLog, AutomationRule, ReturnRequest, User } from '../types';
import { banks } from '../data/banks';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowPathIcon, SparklesIcon, ClipboardDocumentIcon, CheckCircleIcon, ClockIcon } from './icons';
// Google Sheets removed - using Supabase
// import { syncToGoogleSheets, fetchFromGoogleSheets } from '../services/googleSheetsService';
import { useToast } from './Toast';

// Stub constants for removed Google Sheets
const GOOGLE_SCRIPT_URL = ''; // Removed - using Supabase

// Stub type and functions for backwards compatibility
interface GoogleSheetsConfig {
  scriptUrl: string;
  lastSynced?: string;
  autoSync?: boolean;
}
const syncToGoogleSheets = async (_url: string, _data: any) => { return Promise.resolve(); };
const fetchFromGoogleSheets = async (_url: string) => { return Promise.resolve({ orders: [], products: [] }); };

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
  // Google Sheets props removed - using Supabase
  googleSheetsConfig?: GoogleSheetsConfig;
  setGoogleSheetsConfig?: (config: GoogleSheetsConfig) => void;
}

// Updated Script based on user specific column request and formatting preservation
const ADVANCED_SCRIPT_CODE = `
// --- MIXER APP: SCRIPT QUẢN LÝ DỮ LIỆU (V2 - GIỮ ĐỊNH DẠNG & TRẠNG THÁI THANH TOÁN) ---

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Database");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Chưa có dữ liệu" })).setMimeType(ContentService.MimeType.JSON);
  
  var data = sheet.getRange("A1").getValue();
  if (!data) return ContentService.createTextOutput(JSON.stringify({ status: "empty" })).setMimeType(ContentService.MimeType.JSON);
  
  return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    // Nhận dữ liệu text plain để tránh lỗi CORS
    var payload = e.postData.contents;
    var data = JSON.parse(payload);

    // 1. LƯU BẢN GỐC (Database) - Để Restore App
    var sheetDb = doc.getSheetByName("Database");
    if (!sheetDb) { sheetDb = doc.insertSheet("Database"); sheetDb.hideSheet(); }
    sheetDb.getRange("A1").setValue(payload);
    sheetDb.getRange("B1").setValue("Cập nhật: " + new Date());

    // 2. CẬP NHẬT CÁC SHEET BÁO CÁO (Chỉ xóa nội dung, giữ định dạng)
    if (data.orders) updateOrderSheet(doc, data.orders);
    if (data.products) updateInventorySheet(doc, data.products);
    if (data.customers) updateCustomerSheet(doc, data.customers);
    if (data.users) updateStaffSheet(doc, data.users);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Hàm hỗ trợ: Xóa nội dung cũ nhưng giữ tiêu đề và định dạng
function clearOldData(sheet, headerRowIndex) {
  var lastRow = sheet.getLastRow();
  if (lastRow > headerRowIndex) {
    // Xóa từ dòng sau header đến hết, giữ nguyên Format
    sheet.getRange(headerRowIndex + 1, 1, lastRow - headerRowIndex, sheet.getLastColumn()).clearContent();
  }
}

function updateOrderSheet(doc, orders) {
  var sheet = doc.getSheetByName("DonHang");
  if (!sheet) sheet = doc.insertSheet("DonHang");

  var headers = [
    "Mã đơn",           // A
    "Tên Khách hàng",   // B
    "Số điện thoại",    // C
    "Địa chỉ",          // D
    "Tên sản phẩm",     // E
    "Size",             // F
    "Số lượng",         // G
    "Tổng tiền",        // H
    "Trạng thái",       // I
    "Ngày tạo",         // J
    "Thanh toán"        // K
  ];

  // Nếu chưa có tiêu đề thì mới tạo, còn có rồi thì giữ nguyên format của user
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight("bold")
      .setBackground("#4f46e5")
      .setFontColor("white");
  }

  // Xóa dữ liệu cũ (trừ header)
  clearOldData(sheet, 1);

  if (!orders || orders.length === 0) return;

  var rows = [];
  orders.forEach(function(order) {
    // Định dạng ngày giờ
    var date = new Date(order.orderDate);
    var dateStr = date.getDate() + "/" + (date.getMonth()+1) + "/" + date.getFullYear();
    
    // Logic trạng thái thanh toán chi tiết
    var paymentText = "Chờ thanh toán"; // Mặc định
    if (order.paymentStatus === 'Paid') {
      paymentText = "Đã thanh toán";
    } else if (order.paymentMethod === 'cod') {
      paymentText = "Thu hộ (COD)";
    }

    // Loop qua từng sản phẩm để tạo dòng
    order.items.forEach(function(item) {
      rows.push([
        "'" + order.id.substring(0, 8),  // A
        order.customerName,              // B
        "'" + order.customerPhone,       // C
        order.shippingAddress,           // D
        item.productName + " (" + item.color + ")", // E
        item.size,                       // F
        item.quantity,                   // G
        order.totalAmount,               // H
        order.status,                    // I
        dateStr,                         // J
        paymentText                      // K
      ]);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  // Không gọi autoResizeColumns để tôn trọng độ rộng cột người dùng đã chỉnh
}

function updateInventorySheet(doc, products) {
  var sheet = doc.getSheetByName("KhoHang");
  if (!sheet) sheet = doc.insertSheet("KhoHang");
  
  var headers = ["Tên sản phẩm", "Size", "Màu sắc", "Giá bán", "Giá vốn", "Tồn kho", "Cảnh báo"];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#059669").setFontColor("white");
  }
  
  clearOldData(sheet, 1);

  if (!products || products.length === 0) return;

  var rows = [];
  products.forEach(function(p) {
    p.variants.forEach(function(v) {
      rows.push([
        p.name,
        v.size,
        v.color,
        p.price,
        p.costPrice || 0,
        v.stock,
        v.stock <= v.lowStockThreshold ? "SẮP HẾT" : "Đủ"
      ]);
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateCustomerSheet(doc, customers) {
  var sheet = doc.getSheetByName("KhachHang");
  if (!sheet) sheet = doc.insertSheet("KhachHang");

  var headers = ["Tên khách hàng", "SĐT", "Địa chỉ", "Nhãn", "Ngày tham gia"];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#2563eb").setFontColor("white");
  }

  clearOldData(sheet, 1);

  if (!customers || customers.length === 0) return;

  var rows = [];
  customers.forEach(function(c) {
    rows.push([
      c.name,
      "'" + c.phone,
      c.address,
      (c.tags || []).join(", "),
      new Date(c.createdAt).toLocaleDateString()
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function updateStaffSheet(doc, users) {
  var sheet = doc.getSheetByName("NhanSu");
  if (!sheet) sheet = doc.insertSheet("NhanSu");

  var headers = ["Tên nhân viên", "Email", "Vai trò", "Ngày tham gia", "Trạng thái"];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#db2777").setFontColor("white");
  }
  
  clearOldData(sheet, 1);

  if (!users || users.length === 0) return;

  var rows = [];
  users.forEach(function(u) {
    rows.push([
      u.name,
      u.email,
      u.roleId,
      new Date(u.joinDate).toLocaleDateString(),
      u.status
    ]);
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
`;

const SettingsPage: React.FC<SettingsPageProps> = ({ bankInfo, allData, onImportData, theme, setTheme, googleSheetsConfig, setGoogleSheetsConfig }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showScript, setShowScript] = useState(false);
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
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `quanlybanhang-backup-${date}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!window.confirm('Bạn có chắc muốn nhập dữ liệu từ tệp này? Mọi dữ liệu hiện tại sẽ bị ghi đè!')) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result as string;
          const data = JSON.parse(result);
          if (data.orders && data.products && data.customers) {
            onImportData(data);
            toast.success('Dữ liệu đã được nhập thành công!');
          } else {
            throw new Error('Tệp không đúng định dạng.');
          }
        } catch (error) {
          toast.error(`Lỗi khi nhập dữ liệu: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSyncToCloud = async () => {
    if (!googleSheetsConfig.scriptUrl && !GOOGLE_SCRIPT_URL) {
      toast.error('Vui lòng nhập đường dẫn Web App (Script URL) trước.');
      return;
    }

    setIsSyncing(true);
    try {
      // Use configured URL or fallback to manual input
      const urlToUse = GOOGLE_SCRIPT_URL || googleSheetsConfig.scriptUrl;

      // We send the entire allData object. The GAS script expects this structure to split into sheets.
      await syncToGoogleSheets(urlToUse, allData);
      setGoogleSheetsConfig({ ...googleSheetsConfig, lastSynced: new Date().toISOString() });
      toast.success('Đã đồng bộ dữ liệu lên Google Sheet thành công!');
    } catch (error) {
      toast.error('Đồng bộ thất bại. Vui lòng kiểm tra lại đường dẫn và chắc chắn bạn đã deploy Script ở chế độ "Anyone" (Bất kỳ ai).');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!googleSheetsConfig.scriptUrl && !GOOGLE_SCRIPT_URL) {
      toast.error('Vui lòng nhập đường dẫn Web App (Script URL) trước.');
      return;
    }
    if (!window.confirm('Bạn có chắc muốn tải dữ liệu từ Cloud? Dữ liệu hiện tại trên máy này sẽ bị thay thế.')) {
      return;
    }

    setIsSyncing(true);
    try {
      const urlToUse = GOOGLE_SCRIPT_URL || googleSheetsConfig.scriptUrl;
      const data = await fetchFromGoogleSheets(urlToUse);
      if (data.orders && data.products) {
        onImportData(data);
        toast.success('Đã tải và khôi phục dữ liệu từ Cloud thành công!');
      } else {
        throw new Error("Dữ liệu từ Cloud không hợp lệ hoặc trống.");
      }
    } catch (error) {
      toast.error('Tải dữ liệu thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setIsSyncing(false);
    }
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(ADVANCED_SCRIPT_CODE);
    toast.success('Đã sao chép mã Script!');
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Cài đặt Hệ thống</h2>
      </div>
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Cloud Sync Section */}
        <div id="cloud-sync">
          <h3 className="text-xl font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-yellow-500" />
            Đồng bộ Đám mây & Chia Sheet (Google Sheets)
          </h3>
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <p className="text-sm text-muted-foreground mb-4">
              Lưu trữ dữ liệu lên Google Sheets. Hệ thống sẽ tự động cập nhật vào các tab: <strong>DonHang, KhoHang, KhachHang, NhanSu</strong>.
              <br />
              <span className="text-primary font-semibold">Tính năng mới:</span> Giữ nguyên định dạng màu sắc và độ rộng cột của bạn khi đồng bộ.
            </p>

            {GOOGLE_SCRIPT_URL ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-6 flex items-center gap-3">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">Hệ thống đã được kết nối tự động</p>
                  <p className="text-xs text-green-700 dark:text-green-400">Link Google Apps Script đã được cấu hình trong mã nguồn.</p>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300">Hướng dẫn cài đặt Script (Phiên bản V2)</h4>
                  <button onClick={() => setShowScript(!showScript)} className="text-xs text-blue-600 dark:text-blue-400 underline font-bold">
                    {showScript ? 'Ẩn mã' : 'Xem mã & Hướng dẫn'}
                  </button>
                </div>

                {showScript && (
                  <div className="space-y-3 mt-3 animate-fade-in">
                    <ol className="list-decimal pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-2">
                      <li>Mở file Google Sheet của bạn.</li>
                      <li>Chọn <strong>Tiện ích mở rộng</strong> &gt; <strong>Apps Script</strong>.</li>
                      <li>Xóa hết mã cũ, sao chép và dán mã bên dưới vào.</li>
                      <li>Nhấn Lưu (💾).</li>
                      <li>Nhấn <strong>Triển khai (Deploy)</strong> &gt; <strong>Tùy chọn quản lý (Manage deployments)</strong> &gt; Nhấn nút bút chì (Edit).</li>
                      <li>Ở mục "Phiên bản" (Version), chọn <strong>"Phiên bản mới" (New version)</strong>. <span className="text-red-500 font-bold">Bắt buộc phải chọn New version.</span></li>
                      <li>Nhấn Triển khai (Deploy). Copy URL dán vào ô bên dưới.</li>
                    </ol>
                    <div className="relative mt-2">
                      <pre className="bg-slate-800 text-green-400 p-3 rounded-md text-xs overflow-x-auto h-64 border border-slate-700">
                        {ADVANCED_SCRIPT_CODE}
                      </pre>
                      <button
                        onClick={copyScriptToClipboard}
                        className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors text-xs flex items-center gap-1"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" /> Sao chép
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Đường dẫn Web App (Script URL)</label>
                <input
                  type="text"
                  value={GOOGLE_SCRIPT_URL || googleSheetsConfig.scriptUrl}
                  onChange={(e) => setGoogleSheetsConfig({ ...googleSheetsConfig, scriptUrl: e.target.value })}
                  placeholder="https://script.google.com/macros/s/..."
                  disabled={!!GOOGLE_SCRIPT_URL}
                  className="w-full p-3 border border-input rounded-md bg-muted text-sm font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  onClick={handleSyncToCloud}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-md hover:opacity-90 transition-colors disabled:bg-gray-400 shadow-md"
                >
                  <ArrowUpTrayIcon className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  {isSyncing ? 'Đang đồng bộ...' : '☁️ Đồng bộ lên Cloud'}
                </button>
                <button
                  onClick={handleRestoreFromCloud}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-white rounded-md hover:opacity-90 transition-colors disabled:bg-gray-400 shadow-md"
                >
                  <ArrowDownTrayIcon className={`w-5 h-5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  {isSyncing ? 'Đang tải...' : '📥 Tải về từ Cloud'}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <ClockIcon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm text-card-foreground">Tự động đồng bộ (Mỗi phút)</p>
                    <p className="text-xs text-muted-foreground">Hệ thống sẽ tự động lưu dữ liệu lên Cloud sau mỗi 60 giây.</p>
                  </div>
                </div>
                <div
                  onClick={() => setGoogleSheetsConfig({ ...googleSheetsConfig, autoSync: !googleSheetsConfig.autoSync })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${googleSheetsConfig.autoSync ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${googleSheetsConfig.autoSync ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </div>

              {googleSheetsConfig.lastSynced && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Lần đồng bộ cuối: {new Date(googleSheetsConfig.lastSynced).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          </div>
        </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['comfortable', 'compact'].map(d => (
                  <div key={d} onClick={() => setTheme({ ...theme, density: d as any })} className={`p-4 rounded-lg border-2 cursor-pointer transition-all capitalize ${theme.density === d ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-400'}`}>
                    <p className="font-semibold">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Cài đặt thanh toán</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Thông tin tài khoản mặc định hiển thị trên hóa đơn và mã QR.
            </p>
            {bankInfo ? (
              <div className="space-y-4 text-sm">
                <p><span className="font-medium">Ngân hàng:</span> {getBankName(bankInfo.bin)}</p>
                <p><span className="font-medium">STK:</span> {bankInfo.accountNumber}</p>
                <p><span className="font-medium">Chủ TK:</span> {bankInfo.accountName}</p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Chưa có thông tin thanh toán.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-card-foreground mb-4">Quản lý Dữ liệu (Backup File)</h3>
          <div className="bg-card p-6 rounded-xl border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
};

export default SettingsPage;
