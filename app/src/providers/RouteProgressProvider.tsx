'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

interface RouteProgressContextType {
  isNavigating: boolean;
  startNavigation: () => void;
}

const RouteProgressContext = createContext<RouteProgressContextType>({
  isNavigating: false,
  startNavigation: () => {},
});

export function useRouteProgress() {
  return useContext(RouteProgressContext);
}

export function RouteProgressProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  // Reset when the pathname changes (page mounted)
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <RouteProgressContext.Provider value={{ isNavigating, startNavigation }}>
      {children}
    </RouteProgressContext.Provider>
  );
}
