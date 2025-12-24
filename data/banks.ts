export interface Bank {
  bin: string;
  name: string;
  shortName: string;
}

export const banks: Bank[] = [
  { bin: '970418', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { bin: '970415', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { bin: '970422', name: 'Ngân hàng TMCP Quân đội', shortName: 'MB Bank' },
  { bin: '970407', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { bin: '970432', name: 'Ngân hàng TMCP Việt Nam Thịnh vượng', shortName: 'VPBank' },
  { bin: '970406', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { bin: '970436', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { bin: '970405', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam', shortName: 'Agribank' },
  { bin: '970423', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { bin: '970403', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { bin: '970429', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { bin: '970448', name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh', shortName: 'HDBank' },
  { bin: '970441', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { bin: '970454', name: 'Ngân hàng TMCP Việt Nam Thương Tín', shortName: 'VietBank' },
];
