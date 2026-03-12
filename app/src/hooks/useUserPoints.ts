'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

// ---------- Types ----------

export type PointsTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

export interface UserPointsData {
  rank: number;
  totalPoints: number;
  tier: PointsTier;
  referralCode: string;
  referralCount: number;
}

interface UseUserPointsReturn extends UserPointsData {
  loading: boolean;
  isLive: boolean;
}

// ---------- Mock data ----------

const MOCK_USER_POINTS: UserPointsData = {
  rank: 0,
  totalPoints: 0,
  tier: 'Bronze',
  referralCode: '',
  referralCount: 0,
};

// ---------- Helpers ----------

function deriveTier(points: number): PointsTier {
  if (points >= 50_000) return 'Diamond';
  if (points >= 25_000) return 'Gold';
  if (points >= 10_000) return 'Silver';
  return 'Bronze';
}

// ---------- Hook ----------

export function useUserPoints(): UseUserPointsReturn {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const { isAuthenticated } = useFirebaseAuth();

  const [data, setData] = useState<UserPointsData>(MOCK_USER_POINTS);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress || !isFirebaseConfigured()) {
      setData(MOCK_USER_POINTS);
      setLoading(false);
      setIsLive(false);
      return;
    }

    setLoading(true);

    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const userDoc = doc(fireDb, 'users', walletAddress);

    const unsubscribe = onSnapshot(
      userDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(MOCK_USER_POINTS);
          setIsLive(true);
          setLoading(false);
          return;
        }

        const docData = snapshot.data();
        const totalPoints = docData.totalPoints ?? 0;

        setData({
          rank: docData.rank ?? 0,
          totalPoints,
          tier: (docData.tier as PointsTier) ?? deriveTier(totalPoints),
          referralCode: docData.referralCode ?? '',
          referralCount: docData.referralCount ?? 0,
        });
        setIsLive(true);
        setLoading(false);
      },
      (err) => {
        console.warn('[useUserPoints] Firestore listener error:', err);
        setData(MOCK_USER_POINTS);
        setIsLive(false);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isAuthenticated, walletAddress]);

  return { ...data, loading, isLive };
}
