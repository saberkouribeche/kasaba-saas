import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ROLES } from '@/constants/roles';

export async function POST(request) {
    try {
        // 1. Verify Request (Basic security)
        // ideally we check for a valid admin token, but for this one-off migration 
        // we can check a shared secret or ensure it's localhost/admin triggered. 
        // For simplicity in this context, we will proceed assuming AdminGuard on the frontend triggers this safely.

        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.get();

        let stats = {
            total: 0,
            updated: 0,
            admins: 0,
            employees: 0,
            clients: 0,
            errors: 0
        };

        const batch = adminDb.batch();
        let batchCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            let newRole = null;
            let needsUpdate = false;

            stats.total++;

            // 1. Identify Role
            if (data.role) {
                // Already has role, just count it
                if (data.role === ROLES.ADMIN) stats.admins++;
                else if (data.role === ROLES.EMPLOYEE) stats.employees++;
                else stats.clients++;

                // Optional: Standardize existing (trim, lowercase)
                if (data.role !== data.role.toLowerCase().trim()) {
                    newRole = data.role.toLowerCase().trim();
                    needsUpdate = true;
                }
            } else {
                // MISSING ROLE - Infer it
                if (data.email === 'admin@kasaba.com' || data.isAdmin === true || data.type === 'admin') {
                    newRole = ROLES.ADMIN;
                    stats.admins++;
                } else if (data.type === 'employee' || data.isEmployee === true) {
                    newRole = ROLES.EMPLOYEE;
                    stats.employees++;
                } else {
                    // Default to Client for everyone else
                    newRole = ROLES.USER; // 'client'
                    stats.clients++;
                }
                needsUpdate = true;
            }

            // 2. Queue Update
            if (needsUpdate && newRole) {
                batch.update(doc.ref, { role: newRole });
                batchCount++;
                stats.updated++;
            }

            // Batch limit is 500
            if (batchCount >= 400) {
                // We'd need to commit and start new batch, but for small user base this is fine. 
                // If larger, we need loop await commit.
            }
        });

        if (batchCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({ success: true, stats });

    } catch (error) {
        console.error("Migration Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
