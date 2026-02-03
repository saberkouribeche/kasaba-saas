'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Analytics() {
    const [pixels, setPixels] = useState(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        const fetchPixels = async () => {
            try {
                const docRef = doc(db, 'store_settings', 'pixels');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPixels(docSnap.data());
                }
            } catch (error) {
                console.error("Error fetching analytics pixels:", error);
            }
        };
        fetchPixels();
    }, []);

    useEffect(() => {
        if (pixels?.facebook_pixel_id) {
            import('react-facebook-pixel')
                .then((x) => x.default)
                .then((ReactPixel) => {
                    ReactPixel.init(pixels.facebook_pixel_id); // don't forget to pass debug option if you want to
                    ReactPixel.pageView();
                });
        }
    }, [pathname, searchParams, pixels?.facebook_pixel_id]);

    if (!pixels) return null;

    return (
        <>
            {/* TikTok Pixel */}
            {pixels.tiktok_pixel_id && (
                <Script
                    id="tiktok-pixel"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t.split(".").forEach(function(e){t=t[e],e&&t.length==2&&t.push(e)});t.methods.forEach(function(e){t[e]=function(){var n=Array.prototype.slice.call(arguments);t.queue.push([e].concat(n))}})};ttq.setAndDefer(ttq,ttq.methods);ttq.instance=function(t){var e=ttq._i[t]||[];return e.forEach(function(t){var e=Array.prototype.slice.call(arguments);t.queue.push([t].concat(e))}),e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
                ttq.load('${pixels.tiktok_pixel_id}');
                ttq.page();
              }(window, document, 'ttq');
            `,
                    }}
                />
            )}

            {/* Facebook Pixel (Manual Fallback if React-Facebook-Pixel fails or for Next.js Script optimization) */}
            {/* using react-facebook-pixel in useEffect is cleaner for multiple page views in SPA */}
        </>
    );
}
