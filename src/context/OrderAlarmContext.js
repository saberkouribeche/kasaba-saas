"use client";
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import NewOrderModal from '@/components/admin/NewOrderModal';
import { notify } from '@/lib/notify'; // Assuming we have a notify utility

const OrderAlarmContext = createContext();

export const useOrderAlarm = () => useContext(OrderAlarmContext);

export const OrderAlarmProvider = ({ children }) => {
    const [isShiftStarted, setIsShiftStarted] = useState(false);
    const isShiftStartedRef = useRef(isShiftStarted);

    // Load from LocalStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("kasaba_shift_active");
        if (stored === "true") {
            setIsShiftStarted(true);
        }
    }, []);

    // Save to LocalStorage and update Ref
    useEffect(() => {
        isShiftStartedRef.current = isShiftStarted;
        localStorage.setItem("kasaba_shift_active", isShiftStarted);
    }, [isShiftStarted]);

    const [alarmPlaying, setAlarmPlaying] = useState(false);
    const [pendingOrders, setPendingOrders] = useState([]);

    // Refs for audio and processing to avoid re-renders
    const audioRef = useRef(null);
    const lastProcessedTimeRef = useRef(Timestamp.now());

    // Initialize Audio
    useEffect(() => {
        // beep-06.mp3 (Short, clear notification sound)
        const ALARM_SOUND = "/sounds/alarm.mp3";
        audioRef.current = new Audio(ALARM_SOUND);
        audioRef.current.loop = true;

        // Cleanup
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Firestore Listener
    useEffect(() => {
        // Only listen for orders created AFTER the app loaded/refreshed
        // This prevents alarming for old "pending" orders on reload
        // We use a timestamp for this session
        const startTime = Timestamp.now();

        const q = query(
            collection(db, "order"),
            where("created_at", ">", startTime),
            orderBy("created_at", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const newOrder = { id: change.doc.id, ...change.doc.data() };

                    setPendingOrders((prev) => {
                        // Avoid duplicates just in case
                        if (prev.find(o => o.id === newOrder.id)) return prev;
                        return [...prev, newOrder];
                    });

                    triggerAlarm();
                    sendNotification(newOrder);
                }
            });
        });

        return () => unsubscribe();
    }, []);

    const triggerAlarm = async () => {
        if (isShiftStartedRef.current) {
            if (!alarmPlaying) {
                try {
                    await audioRef.current.play();
                    setAlarmPlaying(true);
                } catch (err) {
                    console.error("Audio playback failed:", err);
                    notify.error("فشل تشغيل التنبيه الصوتي - الرجاء التفاعل مع الصفحة");
                }
            }
        } else {
            notify.error("⚠️ طلب جديد! اضغط [بدء الوردية] لتشغيل التنبيهات");
        }
    };

    const stopAlarm = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setAlarmPlaying(false);
    };

    const startShift = async () => {
        try {
            audioRef.current.preload = "auto";
            audioRef.current.volume = 1.0;

            // Play for feedback so user knows it works
            await audioRef.current.play();
            notify.success("✅ تم بدء الوردية - التنبيهات الصوتية مفعلة (اختبار الصوت...)");

            // Stop after 2 seconds (test)
            setTimeout(() => {
                if (!alarmPlaying) { // Only stop if it wasn't a real alarm triggering instantly
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }
            }, 2000);

            setIsShiftStarted(true);

            // Request Notification Permission
            if ("Notification" in window) {
                Notification.requestPermission();
            }
        } catch (err) {
            console.error("Failed to start AudioContext:", err);
            notify.error("حدث خطأ أثناء تفعيل الصوت: " + err.message);
        }
    };

    const acknowledgeOrders = () => {
        stopAlarm();
        setPendingOrders([]);
    };

    const sendNotification = (order) => {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted" && document.hidden) {
            const n = new Notification("طلب جديد! 🔔", {
                body: `الزبون: ${order.customer_name} - المبلغ: ${order.order_total} دج`,
                icon: '/icons/icon-192x192.png' // Adjust path as needed
            });
            n.onclick = () => window.focus();
        }
    };

    return (
        <OrderAlarmContext.Provider value={{ isShiftStarted, startShift, pendingOrders }}>
            {children}
            <NewOrderModal orders={pendingOrders} onAcknowledge={acknowledgeOrders} />
        </OrderAlarmContext.Provider>
    );
};
