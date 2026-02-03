import "../globals.css";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from "@/context/AuthContext";
import AdminGuard from "@/components/admin/AdminGuard";

export const metadata = {
    title: "Admin Panel - Kasaba SaaS",
    description: "Management System",
};

export default function AdminRootLayout({ children }) {
    return (
        <html lang="ar" dir="rtl">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />

                {/* PWA Settings */}
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#ffffff" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            </head>
            <body className="bg-gray-100 min-h-screen font-sans">
                <AuthProvider>
                    <AdminGuard>
                        {children}
                    </AdminGuard>
                </AuthProvider>
                <Toaster />
            </body>
        </html>
    );
}
