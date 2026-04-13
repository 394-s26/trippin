// src/utilities/budget.ts

import { SplitMethod, SplitConfig } from '../types/trip';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';

export const calculateRemainingBudget = (totalBudget: number, currentExpenses: number): number => {
    return totalBudget - currentExpenses;
};

export const isBudgetExceeded = (totalBudget: number, currentExpenses: number): boolean => {
    return currentExpenses > totalBudget;
};

export const formatBudget = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
};

export function calculateUserShare(
  splitMethod: SplitMethod,
  splitConfig: SplitConfig | undefined,
  userId: string,
  totalSpent: number,
  numUsers: number,
  events: Event[],
): number {
  switch (splitMethod) {
    case 'even':
      return totalSpent / (numUsers || 1);
    case 'byEvent':
      return events
        .filter(e => e.paidBy === userId)
        .reduce((sum, e) => sum + (e.cost ?? 0), 0);
    case 'percentage': {
      const pct = splitConfig?.[userId] ?? (100 / (numUsers || 1));
      return totalSpent * (pct / 100);
    }
    case 'shares': {
      const myShares = splitConfig?.[userId] ?? 1;
      const totalShares = Object.values(splitConfig ?? {}).reduce((a, b) => a + b, 0) || numUsers || 1;
      return totalSpent * (myShares / totalShares);
    }
  }
}

export interface BreakdownRow {
  user: AppUser;
  paid: number;     // what they physically paid (sum of their paidBy events)
  owes: number;     // what they should pay based on split method
  balance: number;  // paid - owes (positive = overpaid = owed back to them)
}

export function calculateBreakdown(
  splitMethod: SplitMethod,
  splitConfig: SplitConfig | undefined,
  tripUsers: AppUser[],
  totalSpent: number,
  events: Event[],
): BreakdownRow[] {
  const numUsers = tripUsers.length || 1;

  return tripUsers.map(user => {
    const paid = events
      .filter(e => e.paidBy === user.uid)
      .reduce((sum, e) => sum + (e.cost ?? 0), 0);

    const owes = calculateUserShare(splitMethod, splitConfig, user.uid, totalSpent, numUsers, events);
    return { user, paid, owes, balance: paid - owes };
  });
}
