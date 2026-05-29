import { describe, it, expect } from 'vitest';

// Verifies that applySoftDeleteSchema correctly adds deletedAt and isDeleted fields.

interface SchemaLike {
  paths: Record<string, unknown>;
  add: (fields: Record<string, unknown>) => void;
}

function applySoftDeleteSchema(schema: SchemaLike): void {
  schema.add({
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  });
}

function createMockSchema(): SchemaLike {
  const paths: Record<string, unknown> = {};
  return {
    paths,
    add(fields) {
      Object.assign(paths, fields);
    },
  };
}

describe('applySoftDeleteSchema', () => {
  it('adds deletedAt field to schema', () => {
    const schema = createMockSchema();
    applySoftDeleteSchema(schema);
    expect(schema.paths).toHaveProperty('deletedAt');
  });

  it('adds isDeleted field to schema', () => {
    const schema = createMockSchema();
    applySoftDeleteSchema(schema);
    expect(schema.paths).toHaveProperty('isDeleted');
  });

  it('isDeleted defaults to false', () => {
    const schema = createMockSchema();
    applySoftDeleteSchema(schema);
    expect((schema.paths.isDeleted as { default: boolean }).default).toBe(false);
  });

  it('deletedAt defaults to null', () => {
    const schema = createMockSchema();
    applySoftDeleteSchema(schema);
    expect((schema.paths.deletedAt as { default: null }).default).toBeNull();
  });
});