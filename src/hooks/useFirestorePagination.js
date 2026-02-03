import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs, where } from 'firebase/firestore';

/**
 * Robust Firestore Pagination Hook
 * Supports: Infinite Scroll, Server-Side Filtering, and Server-Side Prefix Search.
 * 
 * @param {string} collectionName - Firestore collection name.
 * @param {number} pageSize - Batch size (default 20).
 * @param {Array} filterConstraints - Array of `where()` clauses.
 * @param {string} searchQuery - Search text (if present, triggers search mode).
 * @param {string} searchField - Field to search on (default 'fullName').
 * @returns {Object} Data, loading state, and control methods.
 */
export function useFirestorePagination(
    collectionName,
    pageSize = 20,
    filterConstraints = [],
    searchQuery = "",
    searchField = "fullName"
) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    // Cursor for pagination
    const lastDocRef = useRef(null);

    // Helper: Build the Query
    const buildQuery = useCallback((isNextPage = false) => {
        const constraints = [...filterConstraints];
        const isSearchMode = searchQuery && searchQuery.trim().length > 0;

        // 1. Base Collection
        let baseRef = collection(db, collectionName);

        // 2. Search Logic vs Normal Logic
        if (isSearchMode) {
            // SEARCH MODE: Prefix Search
            // Note: Firestore requires the field in 'orderBy' to be the same as the inequality filter.
            // Complex filters (e.g. Role + Search) might require a Composite Index in Firestore Console.
            const term = searchQuery.trim(); // Ensure case-matching if needed (usually stored lowercase)

            constraints.push(orderBy(searchField));
            constraints.push(where(searchField, '>=', term));
            constraints.push(where(searchField, '<=', term + '\uf8ff'));
        } else {
            // NORMAL MODE: Date Sort
            constraints.push(orderBy('createdAt', 'desc'));
        }

        // 3. Pagination Cursor
        if (isNextPage && lastDocRef.current) {
            constraints.push(startAfter(lastDocRef.current));
        }

        // 4. Limit
        constraints.push(limit(pageSize));

        return query(baseRef, ...constraints);
    }, [collectionName, pageSize, filterConstraints, searchQuery, searchField]);

    // Action: Fetch Data
    const fetchData = useCallback(async (isNextPage = false) => {
        if (isNextPage && (!hasMore || loading)) return;

        setLoading(true);
        setError(null);

        try {
            const q = buildQuery(isNextPage);
            const snapshot = await getDocs(q);

            const newItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update State
            if (isNextPage) {
                setData(prev => [...prev, ...newItems]);
            } else {
                setData(newItems);
            }

            // Update Cursor & Flags
            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
            setHasMore(snapshot.docs.length === pageSize);

        } catch (err) {
            console.error(`[Pagination] Error in ${collectionName}:`, err);
            // Friendly error for missing index
            if (err.message.includes('requires an index')) {
                setError("Missing Index: Please create a composite index in Firebase Console.");
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [buildQuery, hasMore, loading, collectionName]);

    // Method: Load Next Page
    const fetchNext = () => fetchData(true);

    // Method: Force Refresh (Reset)
    const refresh = () => {
        lastDocRef.current = null;
        setHasMore(true);
        fetchData(false);
    };

    // Effect: Reset and Fetch when core dependencies change (Search or Filters)
    // We rely on the user to use `useMemo` for filterConstraints to avoid infinite loops.
    useEffect(() => {
        // Reset Cursor when filters/search change
        lastDocRef.current = null;
        setHasMore(true);
        fetchData(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionName, searchQuery, searchField, filterConstraints]);

    return {
        data,
        loading,
        error,
        hasMore,
        fetchNext,
        refresh
    };
}
