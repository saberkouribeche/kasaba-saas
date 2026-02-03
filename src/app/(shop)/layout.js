import "../globals.css";
import Script from 'next/script';
// استيراد مباشر بدون أسماء مستعارة لتجنب الأخطاء
import { CartProvider } from "../../context/CartContext";
import { AuthProvider } from "../../context/AuthContext";
import CartDrawer from "../../components/CartDrawer";
import Analytics from "../../components/Analytics";
import FloatingCartSummary from "../../components/FloatingCartSummary";
import InstallPrompt from "../../components/InstallPrompt";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "قصابة المسجد",
  description: "أجود اللحوم الطازجة تصلك لباب منزلك",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* الخط العربي تجوال */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet" />

        {/* PWA Settings */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>

      {/* الخلفية الخارجية داكنة لإبراز التطبيق */}
      <body className="bg-gray-900 flex justify-center min-h-screen">
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>

        {/* === تطبيق الجوال (المحاكي) === */}
        <div className="app-frame">
          <AuthProvider>
            <CartProvider>
              {/* المحتوى يتغير هنا */}
              {children}

              {/* السلة الجانبية تظهر فوق كل شيء داخل الإطار */}
              <FloatingCartSummary />
              <InstallPrompt />
              <CartDrawer />
              <Toaster />
            </CartProvider>
          </AuthProvider>
        </div>

        <Script id="clarity-integration" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "v2mk4l76fp");
          `}
        </Script>

        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                  console.log('ServiceWorker registration successful');
                }, function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}