
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request) {
    try {
        const { phone, password, fullName, zone, addressDetails } = await request.json();

        if (!adminDb) {
            return NextResponse.json({ success: false, error: "Server Configuration Error" }, { status: 500 });
        }

        const docRef = adminDb.collection("users").doc(phone);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            return NextResponse.json({ success: false, error: "رقم الهاتف مسجل بالفعل" }, { status: 409 });
        }

        const newUser = {
            id: phone,
            phone,
            password,
            fullName,
            zone: zone || '',
            addressDetails: addressDetails || '',
            role: 'client', // Default role
            createdAt: FieldValue.serverTimestamp()
        };

        await docRef.set(newUser);

        return NextResponse.json({ success: true, user: newUser });

    } catch (error) {
        console.error("Signup API Error:", error);
        return NextResponse.json({ success: false, error: "حدث خطأ في السيرفر" }, { status: 500 });
    }
}
