import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'zh';

interface Translations {
  [key: string]: {
    en: string;
    zh: string;
  };
}

// All translations for the Cash Agent interface
export const translations: Translations = {
  // Navigation & Headers
  'cash_payments': { en: 'Cash Payments', zh: '现金支付' },
  'scanner': { en: 'Scanner', zh: '扫码' },
  'logout': { en: 'Logout', zh: '退出登录' },
  
  // Tabs
  'to_pay': { en: 'To Pay', zh: '待支付' },
  'paid': { en: 'Paid', zh: '已支付' },
  
  // Payment list
  'amount': { en: 'Amount', zh: '金额' },
  'beneficiary': { en: 'Beneficiary', zh: '收款人' },
  'client': { en: 'Client', zh: '客户' },
  'phone': { en: 'Phone', zh: '电话' },
  'email': { en: 'Email', zh: '邮箱' },
  'date': { en: 'Date', zh: '日期' },
  'status': { en: 'Status', zh: '状态' },
  'payment_id': { en: 'Payment ID', zh: '支付编号' },
  'reference': { en: 'Reference', zh: '参考号' },
  
  // Statuses
  'status_to_pay': { en: 'To Pay', zh: '待支付' },
  'status_paid': { en: 'Paid', zh: '已支付' },
  'status_scanned': { en: 'Scanned', zh: '已扫描' },
  
  // Actions
  'open': { en: 'Open', zh: '打开' },
  'scan_qr': { en: 'Scan QR Code', zh: '扫描二维码' },
  'confirm_payment': { en: 'Confirm Payment', zh: '确认支付' },
  'proceed_to_payment': { en: 'Proceed to Payment', zh: '支付现金' },
  'clear': { en: 'Clear', zh: '清除' },
  'cancel': { en: 'Cancel', zh: '取消' },
  'back': { en: 'Back', zh: '返回' },
  'back_to_list': { en: 'Back to List', zh: '返回列表' },
  'scan_another': { en: 'Scan Another', zh: '扫描下一个' },
  
  // Scanner
  'scanning': { en: 'Scanning...', zh: '扫描中...' },
  'align_qr': { en: 'Align the QR code in the frame', zh: '请将二维码对准框内' },
  'manual_entry': { en: 'Manual Entry', zh: '手动输入' },
  'enter_payment_id': { en: 'Enter Payment ID or QR content', zh: '输入支付编号或二维码内容' },
  'search': { en: 'Search', zh: '搜索' },
  
  // Payment detail
  'payment_details': { en: 'Payment Details', zh: '支付详情' },
  'beneficiary_info': { en: 'Beneficiary Information', zh: '收款人信息' },
  'client_info': { en: 'Client Information', zh: '客户信息' },
  'amount_to_pay': { en: 'Amount to Pay', zh: '支付金额' },
  'verify_identity': { en: 'Verify the beneficiary identity before payment', zh: '付款前请核实收款人身份' },
  
  // Confirmation screen
  'cash_confirmation': { en: 'Cash Payment Confirmation', zh: '现金支付确认' },
  'cash_handed': { en: 'Cash handed to beneficiary', zh: '已向收款人支付现金' },
  'signature_required': { en: 'Signature Required', zh: '需要签名' },
  'sign_here': { en: 'Sign here', zh: '在此签名' },
  'signature_instruction': { en: 'The beneficiary signs here with finger', zh: '收款人在此处用手指签名' },
  'beneficiary_name_confirmed': { en: 'Beneficiary name (confirmed)', zh: '收款人姓名（确认）' },
  'signature_too_short': { en: 'Signature too short, please sign again', zh: '签名太短，请重新签名' },
  
  // Success
  'payment_confirmed': { en: 'Payment Confirmed', zh: '支付已确认' },
  'payment_success': { en: 'Payment Successful!', zh: '支付成功！' },
  'proof_available': { en: 'Proof available', zh: '凭证可用' },
  
  // Errors
  'already_paid': { en: 'Already Paid', zh: '已支付' },
  'already_paid_on': { en: 'Paid on', zh: '支付于' },
  'payment_not_found': { en: 'Payment Not Found', zh: '未找到支付' },
  'invalid_qr': { en: 'Invalid QR Code - Payment not found', zh: '二维码无效 — 未找到支付记录' },
  'not_cash_payment': { en: 'This QR code is not a Cash payment', zh: '该二维码不是现金支付' },
  'camera_permission_denied': { en: 'Camera permission denied. Please allow camera access in your browser settings.', zh: '相机权限被拒绝，请在浏览器设置中允许相机访问。' },
  'camera_not_found': { en: 'No camera detected on this device.', zh: '此设备未检测到相机。' },
  'camera_in_use': { en: 'Camera is in use by another app. Close other apps and try again.', zh: '相机正被其他应用占用，请关闭其他应用后重试。' },
  'camera_back_unavailable': { en: 'Back camera not available. Trying front camera.', zh: '后置相机不可用，正在尝试前置相机。' },
  'camera_https_required': { en: 'Camera is blocked. The site must be opened over HTTPS.', zh: '相机被阻止，必须通过 HTTPS 打开网站。' },
  'camera_start_failed': { en: 'Unable to start camera', zh: '无法启动相机' },
  'error': { en: 'Error', zh: '错误' },
  'retry_scan': { en: 'Retry Scan', zh: '重新扫描' },
  
  // Empty states
  'no_payments': { en: 'No payments found', zh: '暂无支付记录' },
  'no_pending_payments': { en: 'No pending payments', zh: '暂无待支付' },
  'no_paid_payments': { en: 'No paid payments', zh: '暂无已支付' },
  
  // Login
  'login': { en: 'Login', zh: '登录' },
  'email_address': { en: 'Email Address', zh: '邮箱地址' },
  'password': { en: 'Password', zh: '密码' },
  'sign_in': { en: 'Sign In', zh: '登录' },
  'agent_login': { en: 'Cash Agent Login', zh: '现金代理登录' },
  'invalid_credentials': { en: 'Invalid email or password', zh: '邮箱或密码错误' },
  'not_cash_agent': { en: 'This account is not authorized as a Cash Agent', zh: '此账户未被授权为现金代理' },
  
  // Misc
  'loading': { en: 'Loading...', zh: '加载中...' },
  'rmb': { en: 'RMB', zh: '人民币' },
  'signature': { en: 'Signature', zh: '签名' },
  'paid_by': { en: 'Paid by', zh: '支付人' },
  'download_receipt': { en: 'Download Receipt', zh: '下载凭证' },
  'receipt_available_after_payment': { en: 'Available after payment', zh: '支付后可用' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('agent-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('agent-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
