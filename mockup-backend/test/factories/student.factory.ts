import { Model } from 'mongoose';

export interface StudentAttrs {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isVerified?: boolean;
}

/**
 * Dual-mode factory: `build` returns an in-memory object, `create` persists it.
 * Inject the Mongoose model via the constructor so the factory works in any
 * test module without relying on global state.
 */
export class StudentFactory {
  private static counter = 0;

  constructor(private readonly studentModel: Model<any>) {}

  private defaults(): Required<StudentAttrs> {
    StudentFactory.counter += 1;
    return {
      email: `student${StudentFactory.counter}@test.com`,
      password: 'HashedPassword123!',
      firstName: 'Test',
      lastName: `Student${StudentFactory.counter}`,
      isVerified: true,
    };
  }

  build(overrides: Partial<StudentAttrs> = {}): StudentAttrs {
    return { ...this.defaults(), ...overrides };
  }

  async create(overrides: Partial<StudentAttrs> = {}): Promise<any> {
    const attrs = this.build(overrides);
    return this.studentModel.create(attrs);
  }

  async createMany(count: number, overrides: Partial<StudentAttrs> = {}): Promise<any[]> {
    return Promise.all(Array.from({ length: count }, () => this.create(overrides)));
  }
}
