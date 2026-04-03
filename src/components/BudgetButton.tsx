import './BudgetButton.css';
import BudgetModal from './BudgetModal';

const BudgetButton = ({ tripId, spent }: { tripId: string; spent: number }) => {
  return (
    <div className="budget-btn-wrapper">
      <BudgetModal tripId={tripId} spent={spent} />
    </div>
  );
};

export default BudgetButton;
