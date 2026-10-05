import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BattlemapAccessHandoff, type BattlemapAccessMode } from './BattlemapAccessHandoff';

describe('BattlemapAccessHandoff', () => {
  it('explains all three handoff paths without rendering a credential', () => {
    render(<BattlemapAccessHandoff mode="public" />);
    expect(screen.getByText('DM control')).toBeInTheDocument();
    expect(screen.getByText('Player companion')).toBeInTheDocument();
    expect(screen.getByText('Read-only cast')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open DM sign-in' })).toHaveAttribute('href', '/dm');
    expect(document.body.textContent).not.toMatch(/access_token|dm_token|bearer/i);
  });

  it.each([
    ['dm', 'DM control', 'Private controls'],
    ['companion', 'Player companion', 'one character'],
    ['cast', 'Read-only cast', 'without exposing DM controls'],
  ] as Array<[BattlemapAccessMode, string, string]>)('labels the %s mode', (mode, label, detail) => {
    render(<BattlemapAccessHandoff mode={mode} compact />);
    expect(screen.getByLabelText(`Battlemap access mode: ${label}`)).toHaveTextContent(detail);
  });
});
