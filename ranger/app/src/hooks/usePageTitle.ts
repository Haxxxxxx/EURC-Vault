'use client';

import { useEffect } from 'react';

const BASE_TITLE = 'Ranger Earn';

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} | ${BASE_TITLE}`;
    return () => { document.title = `EURC Yield Optimizer | ${BASE_TITLE}`; };
  }, [page]);
}
