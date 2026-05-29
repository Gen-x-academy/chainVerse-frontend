import { vi, describe, it, expect, beforeEach } from 'vitest';

// Minimal health service that uses Mongoose readyState instead of raw TCP
class HealthService {
  private mongoose: { connection: { readyState: number } };

  constructor(mongoose: { connection: { readyState: number } }) {
    this.mongoose = mongoose;
  }

  checkDatabase(): { status: string; connected: boolean } {
    const readyState = this.mongoose.connection.readyState;
    // 1 = connected, anything else = not ready
    const connected = readyState === 1;
    return { status: connected ? 'ok' : 'unavailable', connected };
  }
}

describe('HealthService', () => {
  let service: HealthService;
  const mockMongoose = { connection: { readyState: 1 } };

  beforeEach(() => {
    service = new HealthService(mockMongoose);
  });

  it('returns ok when mongoose readyState is 1 (connected)', () => {
    mockMongoose.connection.readyState = 1;
    const result = service.checkDatabase();
    expect(result.connected).toBe(true);
    expect(result.status).toBe('ok');
  });

  it('returns unavailable when mongoose readyState is 0 (disconnected)', () => {
    mockMongoose.connection.readyState = 0;
    const result = service.checkDatabase();
    expect(result.connected).toBe(false);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when mongoose readyState is 2 (connecting)', () => {
    mockMongoose.connection.readyState = 2;
    const result = service.checkDatabase();
    expect(result.connected).toBe(false);
  });
});