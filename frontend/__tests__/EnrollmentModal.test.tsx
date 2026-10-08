import { render, screen, fireEvent, act } from '@testing-library/react';
import EnrollmentModal, { openEnrollmentModal } from '../components/EnrollmentModal';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('EnrollmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it('does not render when closed', () => {
    render(<EnrollmentModal />);
    const heading = screen.queryByText(/Join Super Profit Masterclass/i);
    expect(heading).not.toBeInTheDocument();
  });

  it('renders correctly when open event is dispatched', async () => {
    render(<EnrollmentModal />);
    act(() => {
      openEnrollmentModal();
    });
    const heading = await screen.findByText(/Join Super Profit Masterclass/i);
    expect(heading).toBeInTheDocument();
  });

  it('closes when Back button is clicked', async () => {
    render(<EnrollmentModal />);
    act(() => {
      openEnrollmentModal();
    });
    const backButton = await screen.findByRole('button', { name: /Back to overview/i });
    expect(backButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(backButton);
    });

    const heading = screen.queryByText(/Join Super Profit Masterclass/i);
    expect(heading).not.toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    render(<EnrollmentModal />);
    act(() => {
      openEnrollmentModal();
    });

    const submitButton = await screen.findByRole('button', { name: /Proceed to Secure Pay/i });
    const form = submitButton.closest('form')!;
    act(() => {
      fireEvent.submit(form);
    });

    const nameError = await screen.findByText(/Full Name must be at least 2 characters/i);
    expect(nameError).toBeInTheDocument();
  });
});
