// ===========================================
// MIXER - GOOGLE SHEETS SYNC SCRIPT
// ===========================================
// Deploy this as Web App in Google Apps Script
// 1. Go to Extensions → Apps Script
// 2. Paste this code
// 3. Deploy → New deployment → Web app
// 4. Execute as: Me, Who has access: Anyone
// 5. Copy the URL and paste into Mixer Settings
// ===========================================

// Configuration
const HEADER_ROW = [
    'Mã đơn', 'Ngày đặt', 'Tên khách hàng', 'Số điện thoại', 'Địa chỉ',
    'Sản phẩm', 'Size', 'Màu sắc', 'Số lượng', 'Tổng tiền',
    'Thanh toán', 'Trạng thái', 'Mã vận đơn', 'Nhân viên', 'Ghi chú', 'Last Updated'
];

// Get or create sheet by name (from Settings - user defined)
function getOrCreateSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Use provided sheetName or fallback to current month
    const name = sheetName || ('Thang' + (new Date().getMonth() + 1));

    let sheet = ss.getSheetByName(name);

    if (!sheet) {
        sheet = ss.insertSheet(name);
        // Add header row
        sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
        sheet.getRange(1, 1, 1, HEADER_ROW.length)
            .setBackground('#4285f4')
            .setFontColor('#ffffff')
            .setFontWeight('bold');
        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidth(1, 100);  // Mã đơn
        sheet.setColumnWidth(2, 140);  // Ngày đặt
        sheet.setColumnWidth(3, 150);  // Tên KH
        sheet.setColumnWidth(4, 120);  // SĐT
        sheet.setColumnWidth(5, 250);  // Địa chỉ
        sheet.setColumnWidth(6, 150);  // Sản phẩm
        sheet.setColumnWidth(7, 60);   // Size
        sheet.setColumnWidth(8, 80);   // Màu
        sheet.setColumnWidth(9, 80);   // Số lượng
        sheet.setColumnWidth(10, 120); // Tổng tiền
        sheet.setColumnWidth(11, 100); // Thanh toán
        sheet.setColumnWidth(12, 100); // Trạng thái
        sheet.setColumnWidth(13, 150); // Mã vận đơn
        sheet.setColumnWidth(14, 100); // Nhân viên
        sheet.setColumnWidth(15, 200); // Ghi chú

        // Set phone column (D) to Plain Text format to preserve leading zeros
        sheet.getRange('D:D').setNumberFormat('@');

        // Center align Order ID column (A)
        sheet.getRange('A:A').setHorizontalAlignment('center');
    }

    return sheet;
}

// Handle POST request from Mixer
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action; // 'create', 'update', 'delete'
        const order = data.order;
        const sheetName = data.sheetName; // Custom sheet name from Mixer Settings

        const sheet = getOrCreateSheet(sheetName);

        if (action === 'create' || action === 'update') {
            syncOrder(sheet, order);
        } else if (action === 'delete') {
            deleteOrder(sheet, order.id);
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Order synced successfully',
            sheet: sheet.getName()
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Sync order to sheet
function syncOrder(sheet, order) {
    const orderId = order.id.substring(0, 8);
    const data = sheet.getDataRange().getValues();

    // Find existing rows for this order (including product rows with empty Order ID)
    const rowsToDelete = [];
    let insertPosition = -1; // Position to insert new rows (if updating)

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === orderId) {
            // Found the main order row - save position for later
            insertPosition = i + 1; // 1-indexed
            rowsToDelete.push(i + 1);

            // Also find subsequent rows with empty Order ID (product continuation rows)
            for (let j = i + 1; j < data.length; j++) {
                if (data[j][0] === '' || data[j][0] === null) {
                    rowsToDelete.push(j + 1);
                } else {
                    // Hit another order, stop
                    break;
                }
            }
            break; // Found the order, exit main loop
        }
    }

    // Delete existing rows (reverse order to preserve indices)
    rowsToDelete.reverse().forEach(row => sheet.deleteRow(row));
    // Format payment display based on method
    const formatPayment = (order) => {
        if (order.paymentMethod === 'cod') {
            return 'Thu hộ (COD)';
        } else if (order.paymentMethod === 'bank_transfer') {
            return order.paymentStatus === 'Paid' ? 'Đã thanh toán' : 'Đợi chuyển khoản';
        }
        return order.paymentStatus || 'Unpaid';
    };

    // Insert new rows for each item
    const items = order.items || [];
    const now = new Date().toLocaleString('vi-VN');
    const paymentDisplay = formatPayment(order);

    items.forEach((item, index) => {
        const isFirstRow = index === 0;
        const rowData = [
            isFirstRow ? orderId : '',  // Mã đơn - chỉ dòng đầu
            isFirstRow ? (order.orderDate ? new Date(order.orderDate).toLocaleString('vi-VN') : '') : '',  // Ngày đặt
            isFirstRow ? (order.customerName || '') : '',  // Tên KH
            isFirstRow ? ("'" + (order.customerPhone || '')) : '',  // SĐT
            isFirstRow ? (order.shippingAddress || '') : '',  // Địa chỉ
            item.productName || '',  // Sản phẩm - luôn hiển thị
            item.size || '',  // Size - luôn hiển thị
            item.color || '',  // Màu - luôn hiển thị
            item.quantity || 1,  // Số lượng - luôn hiển thị
            isFirstRow ? order.totalAmount : '',  // Tổng tiền - chỉ dòng đầu
            isFirstRow ? paymentDisplay : '',  // Thanh toán - COD/Chuyển khoản + trạng thái
            isFirstRow ? (order.status || 'Pending') : '',  // Trạng thái
            isFirstRow ? (order.trackingCode || '') : '',  // Mã vận đơn
            isFirstRow ? (order.staffName || '') : '',  // Nhân viên
            isFirstRow ? (order.notes || '') : '',  // Ghi chú
            isFirstRow ? now : ''  // Last Updated
        ];

        if (insertPosition > 0) {
            // Update existing order - insert at original position
            sheet.insertRowAfter(insertPosition - 1 + index);
            sheet.getRange(insertPosition + index, 1, 1, rowData.length).setValues([rowData]);
        } else {
            // New order - append at bottom
            sheet.appendRow(rowData);
        }
    });

    // If no items, still add one row
    if (items.length === 0) {
        const row = [
            orderId,
            order.orderDate ? new Date(order.orderDate).toLocaleString('vi-VN') : '',
            order.customerName || '',
            "'" + (order.customerPhone || ''),  // Prefix with ' to force text format
            order.shippingAddress || '',
            '',
            '',
            '',
            '',
            order.totalAmount || 0,
            paymentDisplay,  // Thu hộ (COD) / Chuyển khoản
            order.status || 'Pending',
            order.trackingCode || '',
            order.staffName || '',
            order.notes || '',
            now
        ];

        sheet.appendRow(row);
    }

    // Apply color based on status
    const color = getStatusColor(order.status, order.paymentStatus);
    const numRows = Math.max(items.length, 1);

    if (insertPosition > 0) {
        // Updated order - color at original position
        const range = sheet.getRange(insertPosition, 1, numRows, HEADER_ROW.length);
        range.setBackground(color);
        range.setFontColor('#000000'); // Always black text
    } else {
        // New order - color at bottom
        const lastRow = sheet.getLastRow();
        const startRow = lastRow - numRows + 1;
        const range = sheet.getRange(startRow, 1, numRows, HEADER_ROW.length);
        range.setBackground(color);
        range.setFontColor('#000000'); // Always black text
    }
}

// Get background color based on order status
function getStatusColor(status, paymentStatus) {
    // Chờ xử lý + Unpaid = Orange
    if (status === 'Chờ xử lý' && paymentStatus === 'Unpaid') {
        return '#FFE0B2'; // Light Orange
    }

    switch (status) {
        case 'Chờ xử lý':
            return '#FFFFFF'; // White - Pending
        case 'Đang xử lý':
            return '#FFF9C4'; // Light Yellow - Processing
        case 'Đã gửi hàng':
            return '#BBDEFB'; // Light Blue - Shipped
        case 'Đã giao hàng':
            return '#C8E6C9'; // Light Green - Delivered
        case 'Đã hủy':
            return '#E0E0E0'; // Grey - Cancelled
        default:
            return '#FFFFFF'; // White default
    }
}

// Delete order from sheet (including sub-rows without orderId)
function deleteOrder(sheet, orderId) {
    const shortId = orderId.substring(0, 8);
    const data = sheet.getDataRange().getValues();

    const rowsToDelete = [];
    let foundMainRow = false;

    for (let i = 1; i < data.length; i++) {
        const rowOrderId = data[i][0];

        if (rowOrderId === shortId) {
            // Found main row with order ID
            rowsToDelete.push(i + 1);
            foundMainRow = true;
        } else if (foundMainRow && rowOrderId === '') {
            // Found sub-row (no order ID) immediately after main row
            rowsToDelete.push(i + 1);
        } else if (foundMainRow && rowOrderId !== '') {
            // Found next order, stop searching
            break;
        }
    }

    // Delete rows from bottom to top to preserve indices
    rowsToDelete.reverse().forEach(row => sheet.deleteRow(row));
}

// ===========================================
// 2-WAY SYNC: Sheet → Mixer
// ===========================================
// This trigger runs when sheet is edited

function onEdit(e) {
    const sheet = e.source.getActiveSheet();
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();

    // Ignore header row
    if (row === 1) return;

    // Only trigger for specific columns: Trạng thái (12), Mã vận đơn (13), Ghi chú (15)
    if (col !== 12 && col !== 13 && col !== 15) return;

    const orderId = sheet.getRange(row, 1).getValue();
    if (!orderId) return;

    // Get Mixer API URL from script properties
    const props = PropertiesService.getScriptProperties();
    const mixerApiUrl = props.getProperty('MIXER_API_URL');

    if (!mixerApiUrl) {
        Logger.log('MIXER_API_URL not configured');
        return;
    }

    // Prepare update data
    const updateData = {
        orderId: orderId,
        field: col === 12 ? 'status' : col === 13 ? 'trackingCode' : 'notes',
        value: e.value
    };

    // Send to Mixer
    try {
        UrlFetchApp.fetch(mixerApiUrl + '/api/sheets/webhook', {
            method: 'POST',
            contentType: 'application/json',
            payload: JSON.stringify(updateData)
        });
    } catch (error) {
        Logger.log('Error syncing to Mixer: ' + error);
    }
}

// Setup function - Run once to configure
function setup() {
    // Set your Mixer API URL here
    const props = PropertiesService.getScriptProperties();
    props.setProperty('MIXER_API_URL', 'https://mixerottn.vercel.app');

    // Create trigger for onEdit
    const triggers = ScriptApp.getProjectTriggers();
    const hasEditTrigger = triggers.some(t => t.getHandlerFunction() === 'onEdit');

    if (!hasEditTrigger) {
        ScriptApp.newTrigger('onEdit')
            .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
            .onEdit()
            .create();
    }

    Logger.log('Setup complete!');
}

// Test function
function testSync() {
    const testOrder = {
        id: 'test1234-5678-9012-3456',
        orderDate: new Date().toISOString(),
        customerName: 'Nguyen Van A',
        customerPhone: '0901234567',
        shippingAddress: '123 Đường ABC, Quận 1, TP.HCM',
        items: [
            { productName: 'Áo thun', size: 'M', color: 'Đen', quantity: 2, price: 250000 },
            { productName: 'Quần jean', size: 'L', color: 'Xanh', quantity: 1, price: 450000 }
        ],
        totalAmount: 950000,
        paymentStatus: 'Unpaid',
        status: 'Pending',
        trackingCode: '',
        staffName: 'Admin',
        notes: 'Giao buổi sáng'
    };

    const sheet = getOrCreateMonthSheet();
    syncOrder(sheet, testOrder);
    Logger.log('Test sync complete!');
}
