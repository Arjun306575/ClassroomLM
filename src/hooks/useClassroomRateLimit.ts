import { useState, useEffect, useCallback } from 'react';

export function useClassroomRateLimit(maxRequests = 15, cooldownMs = 60000) {
  const [requestCount, setRequestCount] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const startCooldownTimer = useCallback((targetTimestamp: number) => {
    setIsLocked(true);
    
    const initialSecondsLeft = Math.ceil((targetTimestamp - Date.now()) / 1000);
    if (initialSecondsLeft > 0) {
      setRemainingSeconds(initialSecondsLeft);
    } else {
      setIsLocked(false);
      setRemainingSeconds(0);
      setRequestCount(0);
      localStorage.removeItem('classroomlm_request_count');
      localStorage.removeItem('classroomlm_cooldown_until');
      return;
    }

    const interval = setInterval(() => {
      const secondsLeft = Math.ceil((targetTimestamp - Date.now()) / 1000);
      
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setIsLocked(false);
        setRemainingSeconds(0);
        setRequestCount(0);
        localStorage.removeItem('classroomlm_request_count');
        localStorage.removeItem('classroomlm_cooldown_until');
      } else {
        setRemainingSeconds(secondsLeft);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    const savedCount = parseInt(localStorage.getItem('classroomlm_request_count') || '0', 10);
    const savedCooldown = parseInt(localStorage.getItem('classroomlm_cooldown_until') || '0', 10);
    const now = Date.now();

    setRequestCount(savedCount);

    if (savedCooldown && savedCooldown > now) {
      startCooldownTimer(savedCooldown);
    } else {
      // Clear stale cooldown just in case
      localStorage.removeItem('classroomlm_cooldown_until');
      // If we want to reset count on a new day or something we could, but for now just clear if cooldown passed
      if (savedCooldown) {
        setRequestCount(0);
        localStorage.removeItem('classroomlm_request_count');
      }
    }
  }, [startCooldownTimer]);

  const trackRequest = (): boolean => {
    if (isLocked) return false;

    // We can't perfectly rely on requestCount state if multiple requests happen exactly at once,
    // but reading from localStorage helps ensure it's somewhat atomic
    const currentCount = parseInt(localStorage.getItem('classroomlm_request_count') || '0', 10);
    const newCount = currentCount + 1;
    setRequestCount(newCount);
    localStorage.setItem('classroomlm_request_count', newCount.toString());

    if (newCount >= maxRequests) {
      const cooldownEnd = Date.now() + cooldownMs;
      localStorage.setItem('classroomlm_cooldown_until', cooldownEnd.toString());
      startCooldownTimer(cooldownEnd);
      return false; // Request blocked
    }

    return true; // Request allowed
  };

  return { requestCount, remainingSeconds, isLocked, trackRequest };
}
