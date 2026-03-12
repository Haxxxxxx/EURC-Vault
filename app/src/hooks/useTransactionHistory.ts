'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
  where,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { MOCK_TRANSACTIONS } from '@/components/history/TransactionTable';
import type { TRANSACTION_TYPES } from '@/lib/constants';

// ---------- Types ----------

export interface TransactionRecord {
  id: string;
  type: keyof typeof TRANSACTION_TYPES;
  amount: number;
  timestamp: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  signature: string;
  vaultName: string;
  vaultSlug?: string;
}

interface UseTransactionHistoryOptions {
  pageSize?: number;
  filterType?: keyof typeof TRANSACTION_TYPES | null;
  filterVaultSlug?: string | null;
}

interface UseTransactionHistoryReturn {
  transactions: TransactionRecord[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  isLive: boolean;
}

const PAGE_SIZE_DEFAULT = 50;

// ---------- Hook ----------

export function useTransactionHistory(
  options: UseTransactionHistoryOptions = {},
): UseTransactionHistoryReturn {
  const { pageSize = PAGE_SIZE_DEFAULT, filterType = null, filterVaultSlug = null } = options;
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const { isAuthenticated } = useFirebaseAuth();

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Pagination cursor (last doc from previous page)
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [pageCount, setPageCount] = useState(1);

  // Reset when wallet or filters change
  useEffect(() => {
    lastDocRef.current = null;
    setPageCount(1);
    setTransactions([]);
  }, [walletAddress, filterType, filterVaultSlug]);

  useEffect(() => {
    // Fallback to mock data when Firebase is not available
    if (!isAuthenticated || !walletAddress || !isFirebaseConfigured()) {
      let mocked: TransactionRecord[] = MOCK_TRANSACTIONS.map((tx) => ({
        ...tx,
        status: tx.status as TransactionRecord['status'],
        type: tx.type as TransactionRecord['type'],
      }));

      if (filterType) {
        mocked = mocked.filter((tx) => tx.type === filterType);
      }

      setTransactions(mocked);
      setLoading(false);
      setHasMore(false);
      setIsLive(false);
      return;
    }

    setLoading(true);

    // Build Firestore query
    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const txRef = collection(fireDb, 'users', walletAddress, 'transactions');
    const constraints: QueryConstraint[] = [];

    if (filterType) {
      constraints.push(where('type', '==', filterType));
    }
    if (filterVaultSlug) {
      constraints.push(where('vaultSlug', '==', filterVaultSlug));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(pageSize * pageCount));

    const q = query(txRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: TransactionRecord[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<TransactionRecord, 'id'>),
        }));

        setTransactions(docs);
        setHasMore(snapshot.docs.length === pageSize * pageCount);
        setIsLive(true);
        setLoading(false);

        // Track last doc for potential cursor-based pagination
        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }
      },
      (err) => {
        console.warn('[useTransactionHistory] Firestore listener error:', err);
        // Fall back to mock data on error
        setTransactions(
          MOCK_TRANSACTIONS.map((tx) => ({
            ...tx,
            status: tx.status as TransactionRecord['status'],
            type: tx.type as TransactionRecord['type'],
          })),
        );
        setIsLive(false);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isAuthenticated, walletAddress, filterType, filterVaultSlug, pageSize, pageCount]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      setPageCount((prev) => prev + 1);
    }
  }, [hasMore, loading]);

  return { transactions, loading, hasMore, loadMore, isLive };
}
