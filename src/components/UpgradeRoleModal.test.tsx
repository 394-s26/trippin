import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpgradeRoleModal from './UpgradeRoleModal';

describe('UpgradeRoleModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <UpgradeRoleModal isOpen={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders copy and calls onClose when "Got it" is clicked', () => {
    const onClose = vi.fn();
    render(<UpgradeRoleModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText(/auto-fill is for managers/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
