'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateActivityEvents } from '@/lib/liveData';
import type { ActivityEvent } from '@/lib/types';

export function useActivityFeed(maxItems = 30) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (projectId) {
      const q = query(
        collection(db, 'ranger_activity'),
        orderBy('timestamp', 'desc'),
        limit(maxItems),
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityEvent));
          setEvents(records);
          setLoading(false);
        },
        () => {
          setLoading(false);
        },
      );
      return unsub;
    }

    // No Firebase — generate activity from live data patterns
    setEvents(generateActivityEvents(maxItems));
    setLoading(false);
  }, [maxItems]);

  return { events, loading };
}
