'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // For Link component
import { CheckCircle, ArrowRight, UserPlus, ShoppingBag } from 'lucide-react';

import { Suspense } from 'react';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount') || 0;

    // Security: Redirect if no orderId
    useEffect(() => {
        if (!orderId) {
            router.replace('/');
        } else {
            // Pixel: Purchase
            import('react-facebook-pixel')
                .then((x) => x.default)
                .then((ReactPixel) => {
                    ReactPixel.track('Purchase', {
                        currency: 'DZD',
                        value: amount,
                        order_id: orderId
                    });
                });
        }
    }, [orderId, router, amount]);

    if (!orderId) return null; // Prevent flash

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-50/50 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-md text-center">

                {/* Logo Section */}
                <div className="w-40 h-40 mx-auto mb-8 relative">
                    {/* Animated Rings */}
                    <div className="absolute inset-0 border-[3px] border-red-100 rounded-full animate-ping opacity-20 duration-[2000ms]"></div>
                    <div className="absolute -inset-4 border border-red-50 rounded-full animate-pulse opacity-40"></div>

                    <div className="relative bg-white p-6 rounded-full shadow-2xl shadow-red-100/50 border border-red-50 w-full h-full flex items-center justify-center">
                        <img src="/logo.png" alt="Kasaba Logo" className="w-full h-full object-contain" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="mb-10 animate-fade-up">
                    <h1 className="text-4xl font-black text-red-600 mb-4 leading-tight">تم استلام طلبك بنجاح!</h1>
                    <p className="text-slate-500 font-bold text-lg leading-relaxed max-w-xs mx-auto">
                        شكراً لثقتك بنا. <br />
                        سيتم تحضير طلبك وتوصيله إليك في أسرع وقت.
                    </p>

                    {orderId && (
                        <div className="mt-8 flex flex-col items-center justify-center">
                            <div className="bg-gradient-to-b from-red-600 to-red-700 text-white px-10 py-5 rounded-[2rem] shadow-xl shadow-red-200 transform hover:scale-105 transition-transform duration-300 ring-4 ring-red-50">
                                <span className="text-[10px] font-bold opacity-80 block mb-1 uppercase tracking-wider">رقم الطلب</span>
                                <span className="text-4xl font-black tracking-widest font-mono">#{orderId}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Card: Sign Up */}
                <div className="relative overflow-hidden bg-white rounded-3xl p-1 border border-red-100 shadow-2xl shadow-slate-200/50 mb-8 animate-fade-up delay-100 translate-y-4">
                    <div className="bg-gradient-to-br from-red-50/80 to-white rounded-[1.3rem] p-6 text-right">
                        <h3 className="font-black text-xl text-slate-800 flex items-center justify-end gap-2 mb-3">
                            <span>أنشئ حسابك الآن!</span>
                            <UserPlus size={24} className="text-red-500" />
                        </h3>
                        <p className="text-sm text-slate-500 font-bold mb-6 leading-relaxed opacity-90">
                            سجل برقم هاتفك لتتمكن من تتبع حالة طلبك لحظة بلحظة وتسهيل طلباتك القادمة.
                        </p>
                        <Link href="/signup?redirect=track" className="block w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-4 rounded-xl font-black hover:from-red-700 hover:to-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-[0.98] text-center">
                            إنشاء حساب ومتابعة الطلب
                            <ArrowRight className="inline-block mr-2 w-5 h-5" />
                        </Link>
                    </div>
                </div>

                {/* Secondary Action: Back to Home */}
                <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-red-600 font-black transition py-2 animate-fade-up delay-200">
                    <span>العودة للمتجر</span>
                    <ArrowRight size={18} className="rotate-180" />
                </Link>

            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense>
            <SuccessContent />
        </Suspense>
    );
}
