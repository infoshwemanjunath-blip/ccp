import { render, screen, fireEvent } from '@testing-library/react';
import EnrollmentModal, { openEnrollmentModal } from '../components/EnrollmentModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('EnrollmentModal', () => {
  beforeEach(() => {
    // Clear any previous state
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<EnrollmentModal />);
    const heading = screen.queryByText(/Join Super Profit Masterclass/i);
    expect(heading).not.toBeInTheDocument();
  });

  it('renders correctly when open event is dispatched', () => {
    render(<EnrollmentModal />);
    openEnrollmentModal();
    const heading = screen.getByText(/Join Super Profit Masterclass/i);
    expect(heading).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    render(<EnrollmentModal />);
    openEnrollmentModal();
    
    const submitButton = screen.getByRole('button', { name: /Proceed to Secure Pay/i });
    fireEvent.click(submitButton);

    const nameError = await screen.findByText(/Full Name must be at least 2 characters/i);
    expect(nameError).toBeInTheDocument();
  });
});
