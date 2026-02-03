"use client";
import { LayoutDashboard, ShoppingCart, Wallet, Users, Settings, LogOut, Package, CreditCard, ShoppingBag, PlayCircle, PauseCircle, Volume2, Truck, Scale, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from 'react-hot-toast';
import { AdminDataProvider } from "@/context/AdminDataContext"; // Import Data Provider
import { OrderAlarmProvider, useOrderAlarm } from "@/context/OrderAlarmContext";
import AdminGuard from "@/components/admin/AdminGuard";

import OfflineSyncManager from "@/components/OfflineSyncManager";

export default function AdminLayout({ children }) {
  return (
    <AdminDataProvider>
      <OrderAlarmProvider>
        <AdminGuard>
          <AdminLayoutContent>{children}</AdminLayoutContent>
        </AdminGuard>
      </OrderAlarmProvider>
    </AdminDataProvider>
  );
}


import { useState } from "react";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { Menu, X } from "lucide-react";

function AdminLayoutContent({ children }) {
  const pathname = usePathname();
  const { isShiftStarted, startShift } = useOrderAlarm();
  const { logout } = useAuth(); // Destructure logout
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f3f4f6]">
      <OfflineSyncManager />
      {/* === Mobile Header (Visible only on mobile) === */}
      <header className="md:hidden fixed top-0 inset-x-0 h-16 bg-white z-40 border-b border-gray-100 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-glow">
            K
          </div>
          <h1 className="font-black text-slate-800 text-lg tracking-tight">KASABA</h1>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* === Mobile Drawer (Off-Canvas Navigation) === */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="relative w-72 bg-white h-full shadow-2xl animate-slide-in-right flex flex-col">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-glow">
                  K
                </div>
                <div>
                  <h1 className="font-black text-slate-800 text-lg">KASABA</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Admin Panel</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
              <NavItem href="/admin" icon={<LayoutDashboard size={22} />} label="الرئيسية" active={pathname === '/admin'} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/orders" icon={<ShoppingBag size={22} />} label="الطلبات" active={pathname.startsWith('/admin/orders')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/pos" icon={<CreditCard size={22} />} label="نقاط البيع (POS)" active={pathname.startsWith('/admin/pos')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/products" icon={<Package size={22} />} label="المنتجات" active={pathname.startsWith('/admin/products')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/finance" icon={<Wallet size={22} />} label="المالية" active={pathname.startsWith('/admin/finance')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/restaurants" icon={<Users size={22} />} label="الزبائن (B2B)" active={pathname.startsWith('/admin/restaurants')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/suppliers" icon={<Truck size={22} />} label="الموردين" active={pathname.startsWith('/admin/suppliers')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/employees" icon={<Users size={22} />} label="إدارة الموظفين" active={pathname.startsWith('/admin/employees')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/employee" icon={<Store size={22} />} label="بوابة الموظف" active={pathname === '/employee' || pathname.startsWith('/employee/suppliers') || pathname.startsWith('/employee/clients')} onClick={() => setIsMobileMenuOpen(false)} />
              <NavItem href="/admin/inventory-report" icon={<Wallet size={22} />} label="تقرير المخزون" active={pathname.startsWith('/admin/inventory-report')} onClick={() => setIsMobileMenuOpen(false)} />

              <div className="pt-6 mt-6 border-t border-gray-50">
                <p className="px-4 text-xs font-bold text-slate-400 mb-2">النظام</p>
                <NavItem href="/admin/settings" icon={<Settings size={22} />} label="الإعدادات" active={pathname.startsWith('/admin/settings')} onClick={() => setIsMobileMenuOpen(false)} />

                {/* Shift Button in Mobile Drawer */}
                <div className="px-4 mt-4">
                  {!isShiftStarted ? (
                    <button
                      onClick={() => { startShift(); setIsMobileMenuOpen(false); }}
                      className="w-full bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-slate-900/20"
                    >
                      <PlayCircle size={20} /> بدء الوردية
                    </button>
                  ) : (
                    <div className="w-full bg-green-50 text-green-700 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold border border-green-100">
                      <Volume2 size={20} /> الوردية نشطة
                    </div>
                  )}
                </div>
              </div>
            </nav>

            <div className="p-4 border-t border-gray-50 bg-gray-50">
              <button
                onClick={logout}
                className="flex items-center gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 w-full p-3 rounded-2xl transition-all duration-300"
              >
                <LogOut size={20} />
                <span className="font-bold">تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar - القائمة الجانبية (Desktop Only - Unchanged) */}
      <aside className="w-72 bg-white m-4 rounded-[32px] shadow-soft hidden md:flex flex-col border border-gray-100 overflow-hidden relative">
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-glow">
            K
          </div>
          <div>
            <h1 className="font-black text-slate-800 text-xl tracking-tight">KASABA</h1>
            <p className="text-xs text-slate-400 font-bold">لوحة التحكم v3.0 (LIVE)</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
          <NavItem href="/admin" icon={<LayoutDashboard size={22} />} label="الرئيسية" active={pathname === '/admin'} />
          <NavItem href="/admin/orders" icon={<ShoppingBag size={22} />} label="الطلبات" active={pathname.startsWith('/admin/orders')} />
          <NavItem href="/admin/pos" icon={<CreditCard size={22} />} label="نقاط البيع (POS)" active={pathname.startsWith('/admin/pos')} />
          <NavItem href="/admin/products" icon={<Package size={22} />} label="المنتجات" active={pathname.startsWith('/admin/products')} />
          <NavItem href="/admin/finance" icon={<Wallet size={22} />} label="المالية" active={pathname.startsWith('/admin/finance')} />
          <NavItem href="/admin/restaurants" icon={<Users size={22} />} label="الزبائن (B2B)" active={pathname.startsWith('/admin/restaurants')} />
          <NavItem href="/admin/suppliers" icon={<Truck size={22} />} label="الموردين" active={pathname.startsWith('/admin/suppliers')} />
          <NavItem href="/admin/employees" icon={<Users size={22} />} label="إدارة الموظفين" active={pathname.startsWith('/admin/employees')} />
          <NavItem href="/employee" icon={<Store size={22} />} label="بوابة الموظف" active={pathname === '/employee' || pathname.startsWith('/employee/suppliers') || pathname.startsWith('/employee/clients')} />
          <NavItem href="/admin/inventory-report" icon={<Wallet size={22} />} label="تقرير المخزون" active={pathname.startsWith('/admin/inventory-report')} />

          <div className="pt-6 mt-6 border-t border-gray-50">
            <p className="px-4 text-xs font-bold text-slate-400 mb-2">النظام</p>
            <NavItem href="/admin/settings" icon={<Settings size={22} />} label="الإعدادات" active={pathname.startsWith('/admin/settings')} />

            {/* Start Shift Button */}
            <div className="px-4 mt-4">
              {!isShiftStarted ? (
                <button
                  onClick={startShift}
                  className="w-full bg-slate-900 text-white p-3 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 animate-pulse"
                >
                  <PlayCircle size={20} /> بدء الوردية (تفعيل التنبيه)
                </button>
              ) : (
                <div className="w-full bg-green-50 text-green-700 p-3 rounded-2xl flex items-center justify-center gap-2 font-bold border border-green-100">
                  <Volume2 size={20} /> الوردية نشطة
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <button
            onClick={logout}
            className="flex items-center gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 w-full p-3 rounded-2xl transition-all duration-300 group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            <span className="font-bold">تسجيل الخروج</span>
          </button>

        </div>
      </aside>

      {/* Main Content - المحتوى المتغير */}
      <main className="flex-1 overflow-y-auto pt-20 p-4 md:p-6 md:pr-0 md:pt-6">
        <div className="h-full pb-10">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

// مكون فرعي للزر
function NavItem({ href, icon, label, active, onClick }) {
  // Simple check for active state logic would ideally be done via usePathname
  // For now we keep the prop based approach but upgrade UI
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all duration-300 group relative overflow-hidden
        ${active
          ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        }`}
    >
      <span className={`transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110"}`}>{icon}</span>
      <span className="text-base">{label}</span>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-r-full" />}
    </Link>
  );
}