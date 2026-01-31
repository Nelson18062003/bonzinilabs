import { useState, useEffect, useMemo } from 'react';
import { BUSINESS_RULES } from '@/lib/constants';

export interface DepositTimerState {
  /** Hours remaining */
  hours: number;
  /** Minutes remaining */
  minutes: number;
  /** Seconds remaining */
  seconds: number;
  /** Whether the deadline has passed */
  isExpired: boolean;
  /** Formatted time string (e.g., "23h 45min") */
  formattedTime: string;
  /** Percentage of time remaining (0-100) */
  percentRemaining: number;
  /** Total milliseconds remaining */
  totalMillisRemaining: number;
  /** Urgency level based on time remaining */
  urgency: 'normal' | 'warning' | 'critical' | 'expired';
}

/**
 * Hook to calculate and track the countdown timer for a deposit
 * @param createdAt - ISO string of when the deposit was created
 * @param deadlineHours - Number of hours until deadline (defaults to 48)
 * @returns Timer state with countdown values
 */
export function useDepositTimer(
  createdAt: string | undefined | null,
  deadlineHours: number = BUSINESS_RULES.DEPOSIT_PROOF_DEADLINE_HOURS
): DepositTimerState {
  const [now, setNow] = useState(() => Date.now());

  // Calculate deadline from created_at
  const deadline = useMemo(() => {
    if (!createdAt) return null;
    try {
      const created = new Date(createdAt);
      return new Date(created.getTime() + deadlineHours * 60 * 60 * 1000);
    } catch {
      return null;
    }
  }, [createdAt, deadlineHours]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate timer state
  return useMemo(() => {
    if (!deadline) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        formattedTime: 'Expir\u00e9',
        percentRemaining: 0,
        totalMillisRemaining: 0,
        urgency: 'expired' as const,
      };
    }

    const totalDeadlineMs = deadlineHours * 60 * 60 * 1000;
    const remaining = deadline.getTime() - now;
    const totalMillisRemaining = Math.max(0, remaining);
    const isExpired = remaining <= 0;

    if (isExpired) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        formattedTime: 'Expir\u00e9',
        percentRemaining: 0,
        totalMillisRemaining: 0,
        urgency: 'expired' as const,
      };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    const percentRemaining = Math.round((remaining / totalDeadlineMs) * 100);

    // Format time string
    let formattedTime: string;
    if (hours > 0) {
      formattedTime = `${hours}h ${minutes.toString().padStart(2, '0')}min`;
    } else if (minutes > 0) {
      formattedTime = `${minutes}min ${seconds.toString().padStart(2, '0')}s`;
    } else {
      formattedTime = `${seconds}s`;
    }

    // Determine urgency level
    let urgency: 'normal' | 'warning' | 'critical' | 'expired';
    if (hours < 2) {
      urgency = 'critical';
    } else if (hours < 12) {
      urgency = 'warning';
    } else {
      urgency = 'normal';
    }

    return {
      hours,
      minutes,
      seconds,
      isExpired,
      formattedTime,
      percentRemaining,
      totalMillisRemaining,
      urgency,
    };
  }, [now, deadline, deadlineHours]);
}
