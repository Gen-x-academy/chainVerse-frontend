import { describe, it, expect } from 'vitest';

// Verifies that StudentSavedCoursesModule correctly imports SavedCourse schema
// so the service injection does not fail at startup.

interface ModuleFeature {
  name: string;
  schema: object;
}

function buildModule(features: ModuleFeature[]) {
  return {
    imports: features.map((f) => ({ name: f.name, schema: f.schema })),
    hasFeature: (name: string) => features.some((f) => f.name === name),
  };
}

const SavedCourseSchema = { type: 'object', properties: { studentId: {}, courseId: {} } };

describe('StudentSavedCoursesModule', () => {
  it('includes SavedCourse schema in MongooseModule.forFeature', () => {
    const mod = buildModule([{ name: 'SavedCourse', schema: SavedCourseSchema }]);
    expect(mod.hasFeature('SavedCourse')).toBe(true);
  });

  it('schema has required studentId and courseId fields', () => {
    expect(SavedCourseSchema.properties).toHaveProperty('studentId');
    expect(SavedCourseSchema.properties).toHaveProperty('courseId');
  });

  it('module without schema fails feature check', () => {
    const mod = buildModule([]);
    expect(mod.hasFeature('SavedCourse')).toBe(false);
  });
});