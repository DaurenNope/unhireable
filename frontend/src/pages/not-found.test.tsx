import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './not-found';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NotFound page', () => {
  it('renders 404 heading', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('Page Not Found')).toBeTruthy();
  });

  it('calls navigate(-1) when Go Back is clicked', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Go Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
