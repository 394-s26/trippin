import './BudgetButton.css';
import BudgetModal from './BudgetModal';

const BudgetButton = ({ tripId }: { tripId: string }) => {
  return (
    <div className="budget-btn-wrapper">
      <BudgetModal tripId={tripId} />
    </div>
  );
};

export default BudgetButton;
