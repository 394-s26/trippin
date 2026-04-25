import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useTrip from '../hooks/useTrip';
import { PencilIcon, ChevronsUpDownIcon } from '../services/svgIcons';
import { Event } from '../types/event';
import { SplitMethod, SplitConfig } from '../types/trip';
import { AppUser } from '../types/auth';
import { calculateUserShare, calculateBreakdown } from '../utilities/budget';
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
  const [editingConfig, setEditingConfig] = useState<Record<string, number>>({});

  const budget = trip?.budget ?? 0;
  const splitMethod: SplitMethod = trip?.splitMethod ?? 'even';
  const splitConfig: SplitConfig | undefined = trip?.splitConfig;
  const numUsers = tripUsers.length || 1;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtDecimal = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const yourShare = calculateUserShare(splitMethod, splitConfig, currentUserId, spent, numUsers, events);
  const breakdown = calculateBreakdown(splitMethod, splitConfig, tripUsers, spent, events);

  // Initialize editing config when opening modal or switching methods
  useEffect(() => {
    if (!isShareOpen) return;
    initEditingConfig(splitMethod);
  }, [isShareOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const initEditingConfig = (method: SplitMethod) => {
    if (method === 'percentage') {
      const existing = splitConfig ?? {};
      const config: Record<string, number> = {};
      tripUsers.forEach(u => {
        config[u.uid] = existing[u.uid] ?? +(100 / numUsers).toFixed(2);
      });
      setEditingConfig(config);
    } else if (method === 'shares') {
      const existing = splitConfig ?? {};
      const config: Record<string, number> = {};
      tripUsers.forEach(u => {
        config[u.uid] = existing[u.uid] ?? 1;
      });
      setEditingConfig(config);
    } else {
      setEditingConfig({});
    }
  };

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
    if (!canEditSplitMethod) return;
    initEditingConfig(method);
    if (method === 'even' || method === 'byEvent') {
      await updateSplitMethod(method);
    }
    // For percentage/shares, save happens via handleConfigSave
    // But we still need to persist the method choice immediately
    if (method === 'percentage' || method === 'shares') {
      await updateSplitMethod(method);
    }
  };

  const handleConfigSave = async () => {
    await updateSplitMethod(splitMethod, editingConfig);
  };

  // Percentage validation
  const pctTotal = Object.values(editingConfig).reduce((a, b) => a + b, 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.01;

  // Shares derived percentages
  const totalShares = Object.values(editingConfig).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      {/* ── Three Budget Cards ──────────────────────────────────── */}
      <div className="budget-cards-row">
        {/* Card 1: TOTAL BUDGET */}
        {canEditBudget ? (
          <button className="budget-card budget-card--dark" onClick={handleBudgetOpen}>
            <div className="budget-card-text">
              <span className="budget-card-label">TOTAL BUDGET</span>
              <span className="budget-card-value">{fmt(budget)}</span>
            </div>
            <ChevronsUpDownIcon size={22} />
          </button>
        ) : (
          <div className="budget-card budget-card--dark">
            <div className="budget-card-text">
              <span className="budget-card-label">TOTAL BUDGET</span>
              <span className="budget-card-value">{fmt(budget)}</span>
            </div>
          </div>
        )}

        {/* Card 2: SPENT — subtle tint that goes solid red when over budget */}
        {(() => {
          const ratio = budget > 0 ? spent / budget : 0;
          const overBudget = ratio >= 1;
          let style: React.CSSProperties | undefined;
          if (budget > 0) {
            if (overBudget) {
              style = { background: '#f87171', color: 'white' };
            } else {
              // Subtle warm tint that deepens as spending grows
              const alpha = ratio * 0.25; // max 25% opacity before hitting 100%
              style = { background: `rgba(248,113,113,${alpha})` };
            }
          }
          return (
            <div className="budget-card budget-card--spent" style={style}>
              <div className="budget-card-text">
                <span className="budget-card-label">SPENT</span>
                <span className="budget-card-value">{fmt(spent)}</span>
              </div>
            </div>
          );
        })()}

        {/* Card 3: YOUR SHARE — tappable for all roles */}
        <button className="budget-card budget-card--light" onClick={() => setIsShareOpen(true)}>
          <div className="budget-card-text">
            <span className="budget-card-label">YOUR SHARE</span>
            <span className="budget-card-value">{fmt(yourShare)}</span>
          </div>
          {canEditSplitMethod && <PencilIcon size={22} />}
        </button>
      </div>

      {/* ── Budget Edit Modal ───────────────────────────────────── */}
      {isBudgetOpen && createPortal(
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
        </div>,
        document.body
      )}

      {/* ── Split Method Modal ──────────────────────────────────── */}
      {isShareOpen && createPortal(
        <div className="overlay-center" onClick={() => setIsShareOpen(false)}>
          <div className="overlay-panel overlay-panel--sm rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="budget-modal-title">Split Method</h2>

            {/* Split option buttons */}
            <div className="split-options">
              {([
                { key: 'even' as SplitMethod, title: 'Split Evenly', desc: 'Divide the total equally among all members' },
                { key: 'byEvent' as SplitMethod, title: 'Pay for What You Buy', desc: 'Each person pays only for events assigned to them' },
                { key: 'percentage' as SplitMethod, title: 'Split by Percentage', desc: 'Assign a custom percentage to each member' },
                { key: 'shares' as SplitMethod, title: 'Split by Shares', desc: 'Use ratios like 2:1:1 for unequal splits' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  className={`split-option-btn${splitMethod === opt.key ? ' split-option-btn--active' : ''}`}
                  onClick={() => handleSplitSelect(opt.key)}
                  disabled={!canEditSplitMethod}
                >
                  <span className="split-option-title">{opt.title}</span>
                  <span className="split-option-desc">{opt.desc}</span>
                </button>
              )
            )}
            </div>

            {/* Config editor — percentage (owner/manager only) */}
            {canEditSplitMethod && splitMethod === 'percentage' && tripUsers.length > 0 && (
              <div className="split-config">
                <h3 className="split-config-title">Set Percentages</h3>
                {tripUsers.map(user => (
                  <div key={user.uid} className="split-config-row">
                    <div className="split-config-user">
                      <UserAvatar user={user} size="sm" />
                      <span className="split-config-name">{user.firstName}</span>
                    </div>
                    <div className="split-config-input-wrap">
                      <input
                        type="number"
                        className="split-config-input"
                        value={editingConfig[user.uid] ?? 0}
                        onChange={e => setEditingConfig(prev => ({ ...prev, [user.uid]: Number(e.target.value) }))}
                        min={0}
                        max={100}
                        step={0.01}
                      />
                      <span className="split-config-suffix">%</span>
                    </div>
                  </div>
                ))}
                <div className={`split-config-total ${pctValid ? '' : 'split-config-total--invalid'}`}>
                  Total: {pctTotal.toFixed(1)}%
                  {!pctValid && <span className="split-config-warning"> (must equal 100%)</span>}
                </div>
                <button
                  className="split-config-save"
                  onClick={handleConfigSave}
                  disabled={!pctValid}
                >
                  Save Percentages
                </button>
              </div>
            )}

            {/* Config editor — shares (owner/manager only) */}
            {canEditSplitMethod && splitMethod === 'shares' && tripUsers.length > 0 && (
              <div className="split-config">
                <h3 className="split-config-title">Set Shares</h3>
                {tripUsers.map(user => {
                  const shares = editingConfig[user.uid] ?? 1;
                  const pct = (shares / totalShares * 100).toFixed(1);
                  return (
                    <div key={user.uid} className="split-config-row">
                      <div className="split-config-user">
                        <UserAvatar user={user} size="sm" />
                        <span className="split-config-name">{user.firstName}</span>
                      </div>
                      <div className="split-config-input-wrap">
                        <input
                          type="number"
                          className="split-config-input"
                          value={shares}
                          onChange={e => setEditingConfig(prev => ({ ...prev, [user.uid]: Math.max(1, Number(e.target.value)) }))}
                          min={1}
                          step={1}
                        />
                        <span className="split-config-suffix">shares</span>
                      </div>
                      <span className="split-config-pct">{pct}%</span>
                    </div>
                  );
                })}
                <button
                  className="split-config-save"
                  onClick={handleConfigSave}
                >
                  Save Shares
                </button>
              </div>
            )}

            {/* Breakdown table — visible for all roles, all methods */}
            {tripUsers.length > 0 && splitMethod !== 'byEvent' && (
              <div className="split-breakdown">
                <h3 className="split-breakdown-title">Breakdown</h3>
                <div className={`split-breakdown-header ${splitMethod === 'percentage' || splitMethod === 'shares' ? 'split-breakdown-header--4col' : ''}`}>
                  <span>Member</span>
                  <span>Paid</span>
                  {(splitMethod === 'percentage' || splitMethod === 'shares') && <span>Owes</span>}
                  <span>{splitMethod === 'even' ? 'Owed Back' : 'Balance'}</span>
                </div>
                {breakdown.map(({ user, paid, owes, balance }) => (
                  <div key={user.uid} className={`split-breakdown-row ${splitMethod === 'percentage' || splitMethod === 'shares' ? 'split-breakdown-row--4col' : ''}`}>
                    <div className="split-breakdown-user">
                      <UserAvatar user={user} size="sm" />
                      <span className="split-breakdown-name">{user.firstName}</span>
                    </div>
                    <span className="split-breakdown-paid">{fmtDecimal(paid)}</span>
                    {(splitMethod === 'percentage' || splitMethod === 'shares') && (
                      <span className="split-breakdown-paid">{fmtDecimal(owes)}</span>
                    )}
                    <span className={`split-breakdown-owed${balance > 0.01 ? ' split-breakdown-owed--positive' : balance < -0.01 ? ' split-breakdown-owed--negative' : ''}`}>
                      {splitMethod === 'even'
                        ? (balance > 0.01 ? fmtDecimal(balance) : '$0')
                        : (balance > 0.01
                            ? `+${fmtDecimal(balance)}`
                            : balance < -0.01
                              ? fmtDecimal(balance)
                              : '$0'
                          )
                      }
                    </span>
                  </div>
                ))}
                <div className="split-breakdown-footer">
                  {splitMethod === 'even' && (
                    <>
                      <span>Fair share per person</span>
                      <span>{fmtDecimal(spent / numUsers)}</span>
                    </>
                  )}
                  {splitMethod === 'percentage' && (
                    <>
                      <span>Total spent</span>
                      <span>{fmtDecimal(spent)}</span>
                    </>
                  )}
                  {splitMethod === 'shares' && (
                    <>
                      <span>Total spent</span>
                      <span>{fmtDecimal(spent)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* byEvent simple breakdown */}
            {tripUsers.length > 0 && splitMethod === 'byEvent' && (
              <div className="split-breakdown">
                <h3 className="split-breakdown-title">Who Paid What</h3>
                <div className="split-breakdown-header split-breakdown-header--2col">
                  <span>Member</span>
                  <span>Paid</span>
                </div>
                {breakdown.map(({ user, paid }) => (
                  <div key={user.uid} className="split-breakdown-row split-breakdown-row--2col">
                    <div className="split-breakdown-user">
                      <UserAvatar user={user} size="sm" />
                      <span className="split-breakdown-name">{user.firstName}</span>
                    </div>
                    <span className="split-breakdown-paid">{fmtDecimal(paid)}</span>
                  </div>
                ))}
                <div className="split-breakdown-footer">
                  <span>Total spent</span>
                  <span>{fmtDecimal(spent)}</span>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setIsShareOpen(false)} className="split-done-btn">
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default BudgetModal;
