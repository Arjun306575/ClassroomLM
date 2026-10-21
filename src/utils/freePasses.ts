/**
 * Utility for managing daily Free AI Search passes earned via Beat the Bot mini-game (5/5 score).
 * Validity: Valid only on the day earned (not permanent or recurring daily).
 */

const STORAGE_KEY = 'classroomlm_daily_free_ai_searches';
export const FREE_SEARCHES_EVENT = 'classroomlm_free_searches_updated';

export function getTodayDateKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFreeAISearchesRemaining(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed.date === getTodayDateKey()) {
      return Math.max(0, Number(parsed.remaining) || 0);
    }
    // Expired from previous day
    return 0;
  } catch (e) {
    return 0;
  }
}

export function grantFreeAISearches(count = 2): number {
  if (typeof window === 'undefined') return 0;
  try {
    const today = getTodayDateKey();
    const current = getFreeAISearchesRemaining();
    const updatedCount = current + count;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      remaining: updatedCount,
      unlockedAt: Date.now()
    }));
    window.dispatchEvent(new CustomEvent(FREE_SEARCHES_EVENT, { detail: { remaining: updatedCount } }));
    return updatedCount;
  } catch (e) {
    return 0;
  }
}

export function useFreeAISearch(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = getTodayDateKey();
    const current = getFreeAISearchesRemaining();
    if (current > 0) {
      const remaining = current - 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: today,
        remaining,
        lastUsedAt: Date.now()
      }));
      window.dispatchEvent(new CustomEvent(FREE_SEARCHES_EVENT, { detail: { remaining } }));
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}
