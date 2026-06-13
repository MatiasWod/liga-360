import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryLabelBadge } from '../../../../modules/tournaments-list/CategoryLabelBadge';

describe('CategoryLabelBadge', () => {
  it('no renderiza si el label es null o vacío', () => {
    const { container } = render(<CategoryLabelBadge label={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra badge con tooltip de categoría', () => {
    render(<CategoryLabelBadge label="Sub-23" />);
    const badge = screen.getByTitle('Categoría: Sub-23');
    expect(badge).toHaveTextContent('Sub-23');
  });
});
