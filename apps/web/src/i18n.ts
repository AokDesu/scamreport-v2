import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
void i18n.use(initReactI18next).init({
  lng:'th',fallbackLng:'en',interpolation:{escapeValue:false},
  resources:{
    en:{translation:{
      title:'ScamReport',signIn:'Sign in',email:'Email',password:'Password',submit:'Sign in',busy:'Signing in…',
      signOut:'Sign out',loading:'Checking session…',citizen:'Citizen workspace',admin:'Organization workspace',executive:'Executive workspace',
      shell:'Routing shell. The approved reporting and administration screens will be built separately.',
      expired:'Session expired',expiredBody:'Your session is no longer valid. Sign in again to continue.',
      unauthorized:'Unauthorized',unauthorizedBody:'Your account does not have permission to open this workspace.',
      home:'Return to your workspace',notFound:'Page not found',loginError:'Sign-in failed. Check your email and password, then try again.',
      sessionError:'Unable to check your session. Check the local API connection and retry.',retry:'Retry',
    }},
    th:{translation:{
      title:'ScamReport',signIn:'เข้าสู่ระบบ',email:'อีเมล',password:'รหัสผ่าน',submit:'เข้าสู่ระบบ',busy:'กำลังเข้าสู่ระบบ…',
      signOut:'ออกจากระบบ',loading:'กำลังตรวจสอบเซสชัน…',citizen:'พื้นที่ผู้แจ้งเหตุ',admin:'พื้นที่องค์กร',executive:'พื้นที่ผู้บริหาร',
      shell:'โครงเส้นทางเท่านั้น หน้ารายงานและจัดการจะพัฒนาแยกตามแบบที่อนุมัติ',
      expired:'เซสชันหมดอายุ',expiredBody:'เซสชันของคุณใช้ไม่ได้แล้ว กรุณาเข้าสู่ระบบอีกครั้ง',
      unauthorized:'ไม่มีสิทธิ์เข้าถึง',unauthorizedBody:'บัญชีของคุณไม่มีสิทธิ์เปิดพื้นที่นี้',
      home:'กลับพื้นที่ของคุณ',notFound:'ไม่พบหน้า',loginError:'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมลและรหัสผ่านแล้วลองอีกครั้ง',
      sessionError:'ตรวจสอบเซสชันไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ API ในเครื่องแล้วลองอีกครั้ง',retry:'ลองอีกครั้ง',
    }},
  },
});
export default i18n;
