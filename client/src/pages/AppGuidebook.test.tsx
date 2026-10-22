import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppGuidebook from './AppGuidebook';

afterEach(() => vi.unstubAllGlobals());

describe('Arcane Codex search', () => {
  it('has an explicit search identity and retains local filtering and clearing', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(<MemoryRouter><AppGuidebook /></MemoryRouter>);
    const search = screen.getByRole('searchbox', { name: 'Search Arcane Codex' });
    expect(search).toHaveAttribute('type', 'search');
    expect(search).toHaveValue('');
    search.focus();
    expect(search).toHaveFocus();
    const navigation = container.querySelector('aside nav')!;
    const originalCount = within(navigation as HTMLElement).getAllByRole('button').length;
    fireEvent.change(search, { target: { value: 'zzzz-no-guide-match-zzzz' } });
    expect(within(navigation as HTMLElement).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('searchbox', { name: 'Search Arcane Codex' })).toHaveValue('zzzz-no-guide-match-zzzz');
    fireEvent.change(search, { target: { value: 'combat' } });
    expect(within(navigation as HTMLElement).getAllByRole('button').length).toBeGreaterThan(0);
    expect(within(navigation as HTMLElement).getAllByRole('button').length).toBeLessThan(originalCount);
    fireEvent.change(search, { target: { value: '' } });
    expect(within(navigation as HTMLElement).getAllByRole('button')).toHaveLength(originalCount);
    expect(fetch).not.toHaveBeenCalled();
  });
});
