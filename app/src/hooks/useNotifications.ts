'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

// ---------- Types ----------

export interface Notification {
  id: string;
  type: 'epoch' | 'reward' | 'tx_confirmed' | 'tx_failed' | 'security' | 'info';
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  /** Optional link or action reference */
  actionUrl?: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
}

// ---------- Hook ----------

export function useNotifications(maxCount: number = 20): UseNotificationsReturn {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const { isAuthenticated } = useFirebaseAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !isFirebaseConfigured()) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const notificationsRef = collection(fireDb, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientWallet', '==', walletAddress),
      orderBy('createdAt', 'desc'),
      limit(maxCount),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Notification[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Notification, 'id'>),
        }));

        setNotifications(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[useNotifications] Firestore listener error:', err);
        setNotifications([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isAuthenticated, walletAddress, maxCount]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!isFirebaseConfigured()) return;

      try {
        const fireDb = getFirebaseDb();
        if (!fireDb) return;
        const notifDoc = doc(fireDb, 'notifications', notificationId);
        await updateDoc(notifDoc, { read: true });
      } catch (err) {
        console.warn('[useNotifications] Failed to mark as read:', err);
      }
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    if (!isFirebaseConfigured()) return;

    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const unread = notifications.filter((n) => !n.read);
    await Promise.allSettled(
      unread.map((n) => {
        const notifDoc = doc(fireDb, 'notifications', n.id);
        return updateDoc(notifDoc, { read: true });
      }),
    );
  }, [notifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead, loading };
}
