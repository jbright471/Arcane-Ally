import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { EncounterBoard } from './EncounterBoard';
it('hides hidden actors and does not invent withheld health', () => {
  render(<EncounterBoard connected ready round={3} party={[]} initiative={[
    { id: 1, entity_name: 'Hidden sentinel', entity_type: 'monster', is_hidden: 1 },
    { id: 2, entity_name: 'Visible sentinel', entity_type: 'monster', current_hp: null, max_hp: null, is_active: 1 },
  ]} />);
  expect(screen.queryByText('Hidden sentinel')).not.toBeInTheDocument();
  expect(screen.getByText(/Visible sentinel — Current turn/)).toBeInTheDocument();
  expect(screen.getByText(/Health not shared/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('suppresses stale content until all required state is loaded', () => {
  const props = { round: 2, party: [], initiative: [{ id: 1, entity_name: 'Stale actor', entity_type: 'pc' }] };
  const view = render(<EncounterBoard {...props} connected={false} ready />);
  expect(screen.queryByText('Stale actor')).not.toBeInTheDocument();
  view.rerender(<EncounterBoard {...props} connected ready={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText('Stale actor')).not.toBeInTheDocument();
});
