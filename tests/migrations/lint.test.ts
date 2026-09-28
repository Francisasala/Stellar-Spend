import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { lintMigrationSql, DESTRUCTIVE_OVERRIDE_MARKER } from '../../migrations/lint/rules';

describe('lintMigrationSql', () => {
  it('passes a plain, non-destructive migration', () => {
    const result = lintMigrationSql('CREATE TABLE foo (id TEXT PRIMARY KEY);');
    expect(result.safe).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('blocks ALTER TABLE ... ADD COLUMN ... DEFAULT unconditionally', () => {
    const result = lintMigrationSql("ALTER TABLE foo ADD COLUMN bar TEXT DEFAULT 'x';");
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('ADD COLUMN ... DEFAULT');
  });

  describe('destructive change detection', () => {
    const destructiveCases: Array<{ name: string; sql: string }> = [
      { name: 'DROP TABLE', sql: 'DROP TABLE users;' },
      { name: 'DROP COLUMN', sql: 'ALTER TABLE users DROP COLUMN email;' },
      { name: 'TRUNCATE TABLE', sql: 'TRUNCATE TABLE transactions;' },
      { name: 'RENAME COLUMN', sql: 'ALTER TABLE users RENAME COLUMN name TO full_name;' },
    ];

    for (const { name, sql } of destructiveCases) {
      it(`blocks ${name} when no override comment is present`, () => {
        const result = lintMigrationSql(sql);
        expect(result.safe).toBe(false);
        expect(result.violations).toContain(name);
        expect(result.overridden).toEqual([]);
      });

      it(`allows ${name} when the migration includes an explicit override comment`, () => {
        const result = lintMigrationSql(`${sql}\n-- lint:allow-destructive`);
        expect(result.safe).toBe(true);
        expect(result.violations).toEqual([]);
        expect(result.overridden).toContain(name);
      });
    }

    it('applies the override to every destructive statement in the migration', () => {
      const sql = `
        DROP TABLE legacy_users;
        ALTER TABLE users DROP COLUMN legacy_field;
        -- lint:allow-destructive: legacy cleanup, reviewed in PR #964
      `;
      const result = lintMigrationSql(sql);
      expect(result.safe).toBe(true);
      expect(result.overridden.sort()).toEqual(['DROP COLUMN', 'DROP TABLE'].sort());
    });

    it('does not treat an unrelated comment as an override', () => {
      const result = lintMigrationSql('DROP TABLE users; -- please review carefully');
      expect(result.safe).toBe(false);
      expect(DESTRUCTIVE_OVERRIDE_MARKER.test('-- please review carefully')).toBe(false);
    });
  });

  describe('existing migration files', () => {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

    it('finds at least one migration file to check', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      it(`${file} lints clean or carries an explicit destructive override`, () => {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        const result = lintMigrationSql(content);
        expect(result.safe).toBe(true);
      });
    }
  });
});
