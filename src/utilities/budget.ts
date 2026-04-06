// src/utilities/budget.ts

export const calculateRemainingBudget = (totalBudget: number, currentExpenses: number): number => {
    return totalBudget - currentExpenses;
};

export const isBudgetExceeded = (totalBudget: number, currentExpenses: number): boolean => {
    return currentExpenses > totalBudget;
};

export const formatBudget = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
};