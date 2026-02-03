import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request) {
    console.log("🔥 [API] Login Request Received");
    try {
        const { phone, password } = await request.json();
        console.log("🔥 [API] Processing:", phone);

        if (!adminDb) {
            console.error("🔥 [API] AdminDB Missing");
            return NextResponse.json({ success: false, error: "Server Configuration Error" }, { status: 500 });
        }

        // Helper: Timeout Promise
        const timeout = (ms) => new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), ms));

        // 1. Fetch User (With Timeout)
        console.log("🔥 [API] Fetching Firestore Doc...");
        const docRef = adminDb.collection("users").doc(phone);

        // Race Firestore against 5s timeout
        const docSnapOrTimeout = await Promise.race([
            docRef.get(),
            timeout(5000)
        ]);

        if (docSnapOrTimeout === 'TIMEOUT') {
            console.error("🔥 [API] Firestore Read Timed Out");
            return NextResponse.json({ success: false, error: "انتهت مهلة الاتصال بقاعدة البيانات" }, { status: 504 });
        }

        const docSnap = docSnapOrTimeout;
        console.log("🔥 [API] Doc Found:", docSnap.exists);

        if (docSnap.exists) {
            const userData = docSnap.data();
            if (userData.password === password) {
                console.log("🔥 [API] Password Correct");

                // 2. Generate Token (With Timeout)
                try {
                    const { getAuth } = require("firebase-admin/auth");

                    const tokenPromise = (async () => {
                        // Ensure user exists (Idempotent)
                        try {
                            await getAuth().getUser(phone);
                        } catch (e) {
                            if (e.code === 'auth/user-not-found') {
                                await getAuth().createUser({
                                    uid: phone,
                                    displayName: userData.fullName || 'User',
                                });
                            }
                        }
                        return await getAuth().createCustomToken(phone, {
                            role: userData.role || 'client',
                            phone_number: phone
                        });
                    })();

                    const tokenOrTimeout = await Promise.race([
                        tokenPromise,
                        timeout(5000)
                    ]);

                    if (tokenOrTimeout === 'TIMEOUT') {
                        console.error("🔥 [API] Token Generation Timed Out - Returning User Only");
                        // FALLBACK: Return success WITHOUT token (Client will verify via existing Auth or just Redirect)
                        // Note: This effectively bypasses strict Custom Token auth for the session, 
                        // effectively logging them in "statelessly" on the frontend context if we handle it.
                        // But for now, let's return error or try to proceed.
                        return NextResponse.json({ success: false, error: "فشل التحقق من السيرفر (Timeout)" });
                    }

                    console.log("🔥 [API] Token Generated");
                    return NextResponse.json({ success: true, user: userData, token: tokenOrTimeout });

                } catch (tokenError) {
                    console.error("Token Generation Error:", tokenError);
                    return NextResponse.json({ success: true, user: userData });
                }

            } else {
                console.warn("🔥 [API] Invalid Password");
                return NextResponse.json({ success: false, error: "كلمة المرور غير صحيحة" }, { status: 401 });
            }
        } else {
            console.warn("🔥 [API] User Not Found");
            return NextResponse.json({ success: false, error: "رقم الهاتف غير مسجل" }, { status: 404 });
        }

    } catch (error) {
        console.error("Login API Error:", error);
        return NextResponse.json({ success: false, error: "حدث خطأ في السيرفر" }, { status: 500 });
    }
}
