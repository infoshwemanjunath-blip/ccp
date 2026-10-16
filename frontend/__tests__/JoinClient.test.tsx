import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JoinClient from '../app/join/[token]/JoinClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('JoinClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and checks token', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'valid' }),
      } as any)
    );

    render(<JoinClient token="test_token_12345" />);
    expect(screen.getByText(/Validating your secure invitation link/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join Now/i })).toBeInTheDocument();
    });
  });

  it('renders expired state when token is expired', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ state: 'expired' }),
      } as any)
    );

    render(<JoinClient token="test_expired_token" />);

    await waitFor(() => {
      expect(screen.getByText(/Invitation Expired/i)).toBeInTheDocument();
    });
  });

  it('reveals Open Classroom button upon successful verification', async () => {
    // 1. checkToken
    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ state: 'valid' }),
        } as any)
      )
      // 2. verify
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              gcrLink: 'https://classroom.google.com/c/test_course_123',
              sessionToken: 'mock_session_token_123',
            }),
        } as any)
      );

    render(<JoinClient token="valid_tok_abc" />);

    const joinNowBtn = await screen.findByRole('button', { name: /Join Now/i });
    fireEvent.click(joinNowBtn);

    const nameInput = screen.getByPlaceholderText(/Sharma/i);
    const emailInput = screen.getByPlaceholderText(/@gmail\.com/i);
    const phoneInput = screen.getByPlaceholderText(/9876543210/i);

    fireEvent.change(nameInput, { target: { value: 'Rahul Sharma' } });
    fireEvent.change(emailInput, { target: { value: 'rahul@gmail.com' } });
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });

    const unlockBtn = screen.getByRole('button', { name: /Verify & Get Classroom Link/i });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please join the Classroom to complete your enrollment/i)).toBeInTheDocument();
      const openBtn = screen.getByRole('link', { name: /Open Classroom/i });
      expect(openBtn).toHaveAttribute('href', 'https://classroom.google.com/c/test_course_123');
      expect(openBtn).toHaveAttribute('target', '_blank');
      expect(openBtn).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
