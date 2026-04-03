import { useState } from 'react';
import useTrip from '../hooks/useTrip';
import { PencilIcon, ChevronsUpDownIcon } from '../services/svgIcons';
import './BudgetModal.css';

interface BudgetModalProps {
  tripId: string;
  spent: number;
}

const BudgetModal = ({ tripId, spent }: BudgetModalProps) => {
  const { trip, updateBudget } = useTrip(tripId);
  const [inputValue, setInputValue] = useState(trip?.budget ?? 0);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleBudgetOpen = () => {
    setInputValue(trip?.budget ?? 0);
    setIsBudgetOpen(true);
  };

  const handleShareOpen = () => {
    // TODO: Implement various budget splitting methods and update them accordingly.
    setIsShareOpen(true);
  };

  const handleBudgetSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    await updateBudget(inputValue);
    setIsBudgetOpen(false);
  };

  const budget = trip?.budget ?? 0;
  const overBudget = spent > budget;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <>
      <div className="budget-cards-row">
        <button className={`budget-card ${overBudget ? 'budget-card--over' : 'budget-card--dark'}`} onClick={handleBudgetOpen}>
          <div className="budget-card-text">
            <span className="budget-card-label">TOTAL BUDGET</span>
            <span className="budget-card-value">{fmt(spent)} <span className="budget-card-budget">({fmt(budget)})</span></span>
          </div>
          <ChevronsUpDownIcon size={22} />
        </button>

        <button className="budget-card budget-card--light" onClick={handleShareOpen}>
          <div className="budget-card-text">
            <span className="budget-card-label">YOUR SHARE</span>
            <span className="budget-card-value">{fmt(budget)}</span>
          </div>
          <PencilIcon size={22} />
        </button>
      </div>

      {isBudgetOpen && (
        <div className="budget-modal-overlay">
          <div className="budget-modal-backdrop" onClick={() => setIsBudgetOpen(false)} />
          <div className="budget-modal-sheet">
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

      {/* TODO: Update this to work for the share menu */}
      {isShareOpen && (
        <div className="budget-modal-overlay">
          <div className="budget-modal-backdrop" onClick={() => setIsShareOpen(false)} />
          <div className="budget-modal-sheet">
            <h2 className="budget-modal-title">Set Share Method</h2>
            <form onSubmit={handleBudgetSubmit} className="budget-modal-form">
              <label htmlFor="budget" className="budget-modal-label">
                Share Amount
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
              <button type="button" onClick={() => setIsShareOpen(false)} className="budget-cancel-btn">
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BudgetModal;
