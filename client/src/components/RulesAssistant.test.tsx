import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesAssistant } from './RulesAssistant';

describe('Rules Sage dismissal', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens a named non-modal dialog and focuses its named Close control', () => {
    render(<RulesAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Rules Sage' }));
    expect(screen.getByRole('dialog', { name: 'Rules Sage' })).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByRole('button', { name: 'Close Rules Sage' })).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['escape', 'pointer'])('closes with %s and restores launcher focus without sending a request', method => {
    render(<RulesAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Rules Sage' }));
    const close = screen.getByRole('button', { name: 'Close Rules Sage' });
    if (method === 'escape') fireEvent.keyDown(close, { key: 'Escape' });
    else fireEvent.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Rules Sage' })).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains messages and drafts across dismissal without resubmitting', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ answer: 'Synthetic rules answer.' }) } as Response);
    render(<RulesAssistant />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Rules Sage' }));
    fireEvent.change(screen.getByPlaceholderText('Ask about a spell or rule...'), { target: { value: 'Synthetic question' } });
    fireEvent.submit(screen.getByPlaceholderText('Ask about a spell or rule...').closest('form')!);
    await screen.findByText('Synthetic rules answer.');
    fireEvent.change(screen.getByPlaceholderText('Ask about a spell or rule...'), { target: { value: 'Unsent draft' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Ask about a spell or rule...'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Open Rules Sage' }));
    expect(screen.getByText('Synthetic rules answer.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask about a spell or rule...')).toHaveValue('Unsent draft');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ body: JSON.stringify({ question: 'Synthetic question' }) }));
  });

  it('does not intercept Escape outside the non-modal panel or during composition', () => {
    render(<><input aria-label="Outside field" /><RulesAssistant /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Open Rules Sage' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close Rules Sage' }), { key: 'Escape', isComposing: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    screen.getByLabelText('Outside field').focus();
    fireEvent.keyDown(screen.getByLabelText('Outside field'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Outside field')).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });
});
