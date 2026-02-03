import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getAggregateFromServer, sum, count } from "firebase/firestore";

/**
 * Hook to get collection statistics (Total Count, Sum of Field)
 * Server-side Aggregation (Zero reads for documents, 1 read for aggregation)
 * 
 * @param {string} collectionName - Name of the collection
 * @param {string} sumField - Field to sum up (e.g. 'currentDebt')
 * @param {Array} constraints - Where clauses
 * @returns {Object} { count, totalSum, loading, error }
 */
export function useCollectionStats(collectionName, sumField, constraints = []) {
    const [stats, setStats] = useState({ count: 0, totalSum: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchStats = async () => {
            try {
                const coll = collection(db, collectionName);
                const q = query(coll, ...constraints);

                const snapshot = await getAggregateFromServer(q, {
                    count: count(),
                    totalSum: sum(sumField)
                });

                if (isMounted) {
                    setStats({
                        count: snapshot.data().count,
                        totalSum: snapshot.data().totalSum
                    });
                }
            } catch (err) {
                console.error(`Stats Error (${collectionName}):`, err);
                if (isMounted) setError(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchStats();

        return () => { isMounted = false; };
    }, [collectionName, sumField, JSON.stringify(constraints)]);

    return { ...stats, loading, error };
}
