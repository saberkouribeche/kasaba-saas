'use client';
import { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical, PlusSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';

export default function InstallPrompt() {
    const { cart } = useCart();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsMounted(true);

        // Check if running in standalone mode (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');

        if (isStandalone) {
            setIsVisible(false);
            return;
        }

        // iOS Detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        const isChromeIOS = isIosDevice && /crios/.test(userAgent);

        setIsIOS(isIosDevice);

        // Force show if not standalone
        if (isIosDevice) {
            setIsVisible(true);
        } else {
            // On Android, wait 3 seconds. If native prompt fired, good.
            // If not (blocked/already dismissed), show it anyway as manual instruction trigger.
            setTimeout(() => {
                setIsVisible(prev => true);
            }, 3000);
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true); // Ensure it's visible when event fires
        };

        const appInstalledHandler = () => {
            console.log('App successfully installed');
            setIsVisible(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', appInstalledHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', appInstalledHandler);
        };
    }, []);

    const handleInstallClick = async () => {
        // Case 1: Android with Native Prompt
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
            }
            setDeferredPrompt(null);
            return;
        }

        // Case 2: iOS or Android without Prompt -> Show Instructions
        setShowInstructions(!showInstructions);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isMounted || !isVisible || pathname.includes('/b2b/dashboard')) return null;
    if (cart && cart.length > 0) return null;

    // Determine specific text state
    const isChromeIOS = isIOS && /crios/.test(window.navigator.userAgent.toLowerCase());

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-10 duration-700 fade-in zoom-in-95">

            {/* Instructions Modal (Tooltip) */}
            {showInstructions && (
                <div className="absolute bottom-full mb-3 left-0 right-0 bg-white text-gray-900 p-4 rounded-xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
                    <h4 className="font-bold mb-2 text-sm flex items-center gap-2">
                        {isIOS ? 'طريقة التثبيت على الآيفون:' : 'طريقة التثبيت:'}
                    </h4>
                    <ol className="text-xs space-y-2 list-decimal list-inside text-gray-600">
                        {isChromeIOS ? (
                            <>
                                <li className="text-red-600 font-semibold">متصفح كروم على الآيفون لا يدعم التثبيت المباشر.</li>
                                <li>يرجى فتح الموقع في متصفح <span className="font-bold text-blue-600">Safari</span>.</li>
                                <li className="flex items-center gap-1">ثم اضغط <Share size={12} className="inline" /> واختار "إضافة للصفحة الرئيسية".</li>
                            </>
                        ) : isIOS ? (
                            <>
                                <li className="flex items-center gap-2">اضغط على زر المشاركة <Share size={14} className="inline" /> في الأسفل</li>
                                <li className="flex items-center gap-2">اختر <PlusSquare size={14} className="inline" /> "إضافة إلى الصفحة الرئيسية"</li>
                            </>
                        ) : (
                            <>
                                <li className="flex items-center gap-2">اضغط على القائمة <MoreVertical size={14} className="inline" /> في المتصفح</li>
                                <li>اختر "تثبيت التطبيق" أو "Install App"</li>
                            </>
                        )}
                    </ol>
                </div>
            )}

            {/* Main Banner */}
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 max-w-md mx-auto ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-600 p-2.5 rounded-xl shadow-lg shadow-primary-900/20">
                        <Download size={24} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">تطبيق قصابة المسجد</span>
                        <span className="text-xs text-gray-400">
                            {showInstructions ? 'اتبع التعليمات أعلاه' : 'ثبّت التطبيق لتجربة أسرع'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                        aria-label="إغلاق"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg transition-all active:scale-95 whitespace-nowrap"
                    >
                        {showInstructions ? 'حسناً' : 'تثبيت'}
                    </button>
                </div>
            </div>
        </div>
    );
}
