import { useState } from 'react';
import useTrip from '../hooks/useTrip';
import { PencilIcon, ChevronsUpDownIcon } from '../services/svgIcons';
import { Event } from '../types/event';
import { SplitMethod } from '../types/trip';
import { AppUser } from '../types/auth';
import UserAvatar from './UserAvatar';
import './BudgetModal.css';

interface BudgetModalProps {
  tripId: string;
  spent: number;
  events: Event[];
  tripUsers: AppUser[];
  currentUserId: string;
  canEditBudget?: boolean;
  canEditSplitMethod?: boolean;
}

const BudgetModal = ({ tripId, spent, events, tripUsers, currentUserId, canEditBudget = false, canEditSplitMethod = false }: BudgetModalProps) => {
  const { trip, updateBudget, updateSplitMethod } = useTrip(tripId);
  const [inputValue, setInputValue] = useState(trip?.budget ?? 0);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleBudgetOpen = () => {
    setInputValue(trip?.budget ?? 0);
    setIsBudgetOpen(true);
  };

  const handleBudgetSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    await updateBudget(inputValue);
    setIsBudgetOpen(false);
  };

  const handleSplitSelect = async (method: SplitMethod) => {
    await updateSplitMethod(method);
  };

  const budget = trip?.budget ?? 0;
  const splitMethod: SplitMethod = trip?.splitMethod ?? 'even';
  const numUsers = tripUsers.length || 1;
  const overBudget = spent > budget;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtDecimal = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const yourShare = splitMethod === 'even'
    ? budget / numUsers
    : events.filter(e => e.paidBy === currentUserId).reduce((sum, e) => sum + (e.cost ?? 0), 0);

  // Breakdown for "split evenly" table: how much each person has paid vs. their fair share
  const fairShare = spent / numUsers;
  const breakdown = tripUsers.map(user => {
    const paid = events.filter(e => e.paidBy === user.uid).reduce((sum, e) => sum + (e.cost ?? 0), 0);
    const owed = Math.max(0, paid - fairShare);
    return { user, paid, owed };
  });

  return (
    <>
      <div className="budget-cards-row">
        {canEditBudget ? (
          <button className={`budget-card ${overBudget ? 'budget-card--over' : 'budget-card--dark'}`} onClick={handleBudgetOpen}>
            <div className="budget-card-text">
              <span className="budget-card-label">TOTAL BUDGET</span>
              <span className="budget-card-value">{fmt(spent)} <span className="budget-card-budget">({fmt(budget)})</span></span>
            </div>
            <ChevronsUpDownIcon size={22} />
          </button>
        ) : (
          <div className={`budget-card ${overBudget ? 'budget-card--over' : 'budget-card--dark'}`}>
            <div className="budget-card-text">
              <span className="budget-card-label">TOTAL BUDGET</span>
              <span className="budget-card-value">{fmt(spent)} <span className="budget-card-budget">({fmt(budget)})</span></span>
            </div>
          </div>
        )}

        {canEditSplitMethod ? (
          <button className="budget-card budget-card--light" onClick={() => setIsShareOpen(true)}>
            <div className="budget-card-text">
              <span className="budget-card-label">YOUR SHARE</span>
              <span className="budget-card-value">{fmt(yourShare)}</span>
            </div>
            <PencilIcon size={22} />
          </button>
        ) : (
          <div className="budget-card budget-card--light">
            <div className="budget-card-text">
              <span className="budget-card-label">YOUR SHARE</span>
              <span className="budget-card-value">{fmt(yourShare)}</span>
            </div>
          </div>
        )}
      </div>

      {isBudgetOpen && (
        <div className="overlay-bottom">
          <div className="overlay-scrim" onClick={() => setIsBudgetOpen(false)} />
          <div className="overlay-panel overlay-panel--sm rounded-t-2xl p-6 pb-8 animate-slide-up">
            <h2 className="budget-modal-title">Set Trip Budget</h2>
            <form onSubmit={handleBudgetSubmit} className="budget-modal-form">
              <label htmlFor="budget" className="budget-modal-label">
                Budget Amount
              </label>
              <div className="budget-input-wrapper">
                <span className="budget-input-prefix">$</span>
                <input
                  type="number"
                  id="budget"
                  value={inputValue}
                  onChange={(e) => setInputValue(Number(e.target.value))}
                  className="budget-input"
                  required
                  min={0}
                />
              </div>
              <button type="submit" className="budget-submit-btn">
                Confirm
              </button>
              <button type="button" onClick={() => setIsBudgetOpen(false)} className="budget-cancel-btn">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {isShareOpen && (
        <div className="overlay-center" onClick={() => setIsShareOpen(false)}>
          <div className="overlay-panel overlay-panel--sm rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="budget-modal-title">Split Method</h2>

            <div className="split-options">
              <button
                className={`split-option-btn${splitMethod === 'even' ? ' split-option-btn--active' : ''}`}
                onClick={() => handleSplitSelect('even')}
              >
                <span className="split-option-title">Split Evenly</span>
                <span className="split-option-desc">Divide the total budget equally among all members</span>
              </button>
              <button
                className={`split-option-btn${splitMethod === 'byEvent' ? ' split-option-btn--active' : ''}`}
                onClick={() => handleSplitSelect('byEvent')}
              >
                <span className="split-option-title">Pay for What You Buy</span>
                <span className="split-option-desc">Each person pays only for the events assigned to them</span>
              </button>
            </div>

            {splitMethod === 'even' && tripUsers.length > 0 && (
              <div className="split-breakdown">
                <h3 className="split-breakdown-title">Breakdown</h3>
                <div className="split-breakdown-header">
                  <span>Member</span>
                  <span>Paid</span>
                  <span>Owed Back</span>
                </div>
                {breakdown.map(({ user, paid, owed }) => (
                  <div key={user.uid} className="split-breakdown-row">
                    <div className="split-breakdown-user">
                      <UserAvatar user={user} size="sm" />
                      <span className="split-breakdown-name">{user.firstName}</span>
                    </div>
                    <span className="split-breakdown-paid">{fmtDecimal(paid)}</span>
                    <span className={`split-breakdown-owed${owed > 0 ? ' split-breakdown-owed--positive' : ''}`}>
                      {owed > 0 ? fmtDecimal(owed) : '$0'}
                    </span>
                  </div>
                ))}
                <div className="split-breakdown-footer">
                  <span>Fair share per person</span>
                  <span>{fmtDecimal(fairShare)}</span>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setIsShareOpen(false)} className="split-done-btn">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BudgetModal;
