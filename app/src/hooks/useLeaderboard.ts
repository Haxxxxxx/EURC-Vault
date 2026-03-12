'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

// ---------- Types ----------

export interface LeaderboardEntry {
  rank: number;
  address: string;
  points: number;
  staked: number;
  referrals: number;
}

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[];
  loading: boolean;
  isLive: boolean;
}

// ---------- Mock data (matches leaderboard page) ----------

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, address: '7xKe...9FzQ', points: 28_450, staked: 125_000, referrals: 42 },
  { rank: 2, address: '3mPq...4WvR', points: 24_320, staked: 98_500, referrals: 35 },
  { rank: 3, address: '9aLn...7HcD', points: 21_180, staked: 87_200, referrals: 28 },
  { rank: 4, address: 'Bf4x...2KmS', points: 18_900, staked: 74_300, referrals: 22 },
  { rank: 5, address: '5dRt...8NwJ', points: 16_740, staked: 65_100, referrals: 19 },
  { rank: 6, address: 'Hj7y...1QpF', points: 14_200, staked: 52_800, referrals: 15 },
  { rank: 7, address: '2cVn...6TgA', points: 11_850, staked: 43_600, referrals: 12 },
  { rank: 8, address: 'Dk9w...3MrE', points: 9_600, staked: 38_200, referrals: 9 },
  { rank: 9, address: '8fZp...5YsB', points: 7_430, staked: 29_400, referrals: 7 },
  { rank: 10, address: 'Qm1a...4LxC', points: 6_100, staked: 21_700, referrals: 5 },
];

// ---------- Hook ----------

export function useLeaderboard(topN: number = 10): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setEntries(MOCK_LEADERBOARD.slice(0, topN));
      setLoading(false);
      setIsLive(false);
      return;
    }

    setLoading(true);

    const fireDb = getFirebaseDb();
    if (!fireDb) return;
    const leaderboardRef = collection(fireDb, 'leaderboard');
    const q = query(leaderboardRef, orderBy('totalPoints', 'desc'), limit(topN));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: LeaderboardEntry[] = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          return {
            rank: index + 1,
            address: data.address ?? doc.id,
            points: data.totalPoints ?? 0,
            staked: data.totalStaked ?? 0,
            referrals: data.referralCount ?? 0,
          };
        });

        setEntries(docs);
        setIsLive(true);
        setLoading(false);
      },
      (err) => {
        console.warn('[useLeaderboard] Firestore listener error:', err);
        setEntries(MOCK_LEADERBOARD.slice(0, topN));
        setIsLive(false);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [topN]);

  return { entries, loading, isLive };
}
