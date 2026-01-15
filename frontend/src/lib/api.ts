import { getSession } from 'next-auth/react';
import { apiUrl } from './config';

/**
 * Authenticated Fetch Wrapper
 * Automatically adds Authorization header with JWT token
 */
export async function authFetch(endpoint: string, options: RequestInit = {}) {
  const session = await getSession();
  
  if (!session?.idToken) {
    console.warn('[AuthFetch] No active session found');
    throw new Error('Unauthorized: No active session');
  }

  // Ensure endpoint starts with / if not absolute
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${apiUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.idToken}`,
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Hook-friendly helpers can be added here if needed
 */
