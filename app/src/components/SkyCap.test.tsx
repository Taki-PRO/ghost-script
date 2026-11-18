import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SkyCap } from './SkyCap';

afterEach(cleanup);

describe('SkyCap', () => {
  it('is one decorative div hidden from assistive technology', () => {
    const { container } = render(<SkyCap />);
    expect(container.children).toHaveLength(1);
    const cap = screen.getByTestId('sky-cap');
    expect(cap.tagName).toBe('DIV');
    expect(cap.className).toBe('sky-cap');
    expect(cap.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no tabindex and holds nothing focusable', () => {
    render(<SkyCap />);
    const cap = screen.getByTestId('sky-cap');
    expect(cap.hasAttribute('tabindex')).toBe(false);
    expect(cap.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
    expect(cap.children).toHaveLength(0);
  });

  it('is absent from role queries', () => {
    render(<SkyCap />);
    const cap = screen.getByTestId('sky-cap');
    for (const role of ['generic', 'presentation', 'none', 'img']) {
      expect(screen.queryAllByRole(role)).not.toContain(cap);
    }
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});
