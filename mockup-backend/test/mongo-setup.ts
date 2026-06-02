import mongoose from 'mongoose';

/**
 * Verify the test database is reachable before the suite runs.
 * Fails fast so engineers see a clear error instead of cryptic test failures.
 */
export async function connectTestDb(): Promise<mongoose.Connection> {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/chainverse_test';
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    // Confirm the connection is actually responsive with a ping
    await conn.db.admin().ping();
    return conn;
  } catch (err) {
    throw new Error(
      `Test MongoDB unreachable at ${uri}. ` +
        `Start mongo or set MONGO_URI before running tests.\nCause: ${err}`,
    );
  }
}

export async function disconnectTestDb(conn: mongoose.Connection): Promise<void> {
  await conn.close();
}

/**
 * Integration test: app module boots and MongoDB connection is established.
 */
describe('MongoDB connection', () => {
  let conn: mongoose.Connection;

  beforeAll(async () => {
    conn = await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb(conn);
  });

  it('should connect to the test database', () => {
    expect(conn.readyState).toBe(1); // 1 = connected
  });

  it('should respond to a ping', async () => {
    const result = await conn.db.admin().ping();
    expect(result).toMatchObject({ ok: 1 });
  });
});
