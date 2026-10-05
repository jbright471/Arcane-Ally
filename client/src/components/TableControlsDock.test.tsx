import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TableControlsDock } from './TableControlsDock';

it('groups persistent table controls under one accessible dock', () => {
  render(
    <TableControlsDock>
      <button>Effects</button>
      <button>Rules</button>
      <button>Voice</button>
    </TableControlsDock>,
  );

  const dock = screen.getByRole('group', { name: 'Table tools' });
  expect(dock).toHaveAttribute('data-table-controls-dock');
  expect(screen.getAllByRole('button')).toHaveLength(3);
});

