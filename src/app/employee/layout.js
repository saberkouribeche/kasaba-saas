"use client";
import "@/app/globals.css";
import { AdminDataProvider } from "@/context/AdminDataContext";
import { Toaster } from "react-hot-toast";

export default function EmployeeLayout({ children }) {
    return (
        <html lang="ar" dir="rtl">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
            </head>
            <body className="bg-slate-50 min-h-screen font-cairo">
                <AdminDataProvider>
                    <div className="min-h-screen">
                        {children}
                        <Toaster position="top-center" />
                    </div>
                </AdminDataProvider>
            </body>
        </html>
    );
}
