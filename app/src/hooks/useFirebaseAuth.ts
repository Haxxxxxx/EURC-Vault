'use client';

import { useContext } from 'react';
import { FirebaseAuthContext, type FirebaseAuthContextType } from '@/providers/FirebaseAuthProvider';

/**
 * Returns the Firebase auth context from FirebaseAuthProvider.
 *
 * - `firebaseUser` -- Firebase User object or null
 * - `isAuthenticated` -- true when a Firebase session is active
 * - `loading` -- true during the SIWS sign-in flow
 * - `signIn()` -- manually trigger Sign-In With Solana
 */
export function useFirebaseAuth(): FirebaseAuthContextType {
  return useContext(FirebaseAuthContext);
}
