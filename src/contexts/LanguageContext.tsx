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
  'scanner': { en: 'Scanner', zh: '扫描' },
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
  'clear': { en: 'Clear', zh: '清除' },
  'cancel': { en: 'Cancel', zh: '取消' },
  'back': { en: 'Back', zh: '返回' },
  'back_to_list': { en: 'Back to List', zh: '返回列表' },
  'scan_another': { en: 'Scan Another', zh: '扫描下一个' },
  
  // Scanner
  'scanning': { en: 'Scanning...', zh: '扫描中...' },
  'manual_entry': { en: 'Manual Entry', zh: '手动输入' },
  'enter_payment_id': { en: 'Enter Payment ID', zh: '输入支付编号' },
  'search': { en: 'Search', zh: '搜索' },
  
  // Payment detail
  'payment_details': { en: 'Payment Details', zh: '支付详情' },
  'beneficiary_info': { en: 'Beneficiary Information', zh: '收款人信息' },
  'amount_to_pay': { en: 'Amount to Pay', zh: '支付金额' },
  'signature_required': { en: 'Signature Required', zh: '需要签名' },
  'sign_here': { en: 'Sign here', zh: '在此签名' },
  'signature_instruction': { en: 'The beneficiary must sign below to confirm receipt', zh: '收款人需在下方签名确认收款' },
  
  // Success
  'payment_confirmed': { en: 'Payment Confirmed', zh: '支付已确认' },
  'payment_success': { en: 'Payment Successful!', zh: '支付成功！' },
  
  // Errors
  'already_paid': { en: 'Already Paid', zh: '已支付' },
  'payment_not_found': { en: 'Payment Not Found', zh: '未找到支付' },
  'invalid_qr': { en: 'Invalid QR Code', zh: '无效的二维码' },
  'error': { en: 'Error', zh: '错误' },
  
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
