/**
 * Generates a UUID (v4) for use as a unique identifier.
 * Falls back to a custom implementation if crypto.randomUUID is not available.
 * 
 * @returns A UUID string
 */
export function generateUUID(): string {
  // Use the built-in randomUUID function if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for browsers that don't support crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 