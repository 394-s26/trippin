import './BudgetButton.css';
import BudgetModal from './BudgetModal';
import { Event } from '../types/event';
import { AppUser } from '../types/auth';

interface BudgetButtonProps {
  tripId: string;
  spent: number;
  events: Event[];
  tripUsers: AppUser[];
  currentUserId: string;
}

const BudgetButton = ({ tripId, spent, events, tripUsers, currentUserId }: BudgetButtonProps) => {
  return (
    <div className="budget-btn-wrapper">
      <BudgetModal tripId={tripId} spent={spent} events={events} tripUsers={tripUsers} currentUserId={currentUserId} />
    </div>
  );
};

export default BudgetButton;
