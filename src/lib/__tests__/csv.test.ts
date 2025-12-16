import { describe, expect, it } from 'vitest';
import { parseLeadsCsv } from '../csv';

describe('parseLeadsCsv', () => {
  it('parses basic CSV into lead rows', () => {
    const csv =
      'email,first_name,last_name,company,title,website\n' +
      'a@example.com,Alice,Smith,Acme,Head of Growth,https://acme.example\n';

    const rows = parseLeadsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'a@example.com',
      first_name: 'Alice',
      last_name: 'Smith',
      company: 'Acme',
      title: 'Head of Growth',
      website: 'https://acme.example'
    });
  });

  it('supports firstname/lastname headers', () => {
    const csv = 'email,firstname,lastname\n' + 'a@example.com,Alice,Smith\n';
    const rows = parseLeadsCsv(csv);
    expect(rows[0]).toMatchObject({ first_name: 'Alice', last_name: 'Smith' });
  });
});
