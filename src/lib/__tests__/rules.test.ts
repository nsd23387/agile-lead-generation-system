import { describe, expect, it } from 'vitest';
import { scoreLead } from '../rules';

describe('scoreLead', () => {
  it('adds points for contains/not_empty rules', () => {
    const rules = [
      { points: 10, field: 'title', op: 'contains', value: 'Head' } as const,
      { points: 5, field: 'company', op: 'not_empty' } as const
    ];

    expect(scoreLead({ title: 'Head of Growth', company: 'Acme' } as any, rules as any)).toBe(15);
    expect(scoreLead({ title: 'Marketing Manager', company: 'Acme' } as any, rules as any)).toBe(5);
    expect(scoreLead({ title: 'Head of Growth', company: '' } as any, rules as any)).toBe(10);
  });
});
