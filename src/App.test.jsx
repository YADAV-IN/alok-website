import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    })
  );
});

test('renders ALOK brand title', () => {
  render(<App />);
  const title = screen.getByText(/ALOK/i);
  expect(title).toBeDefined();
});
