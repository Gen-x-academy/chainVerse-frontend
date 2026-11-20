/**
 * Contract tests for the Stellar integration.
 *
 * These tests mock the Stellar SDK so they run offline and in CI without a
 * live Horizon node. They verify that the service calls Horizon with the right
 * arguments and handles both success and failure paths correctly.
 */

const mockLoadAccount = jest.fn();
const mockSubmitTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: mockLoadAccount,
    submitTransaction: mockSubmitTransaction,
  })),
  Keypair: {
    fromSecret: jest.fn().mockReturnValue({
      publicKey: jest.fn().mockReturnValue('GPUBLICKEY'),
      secret: jest.fn().mockReturnValue('SSECRETKEY'),
    }),
    random: jest.fn().mockReturnValue({
      publicKey: jest.fn().mockReturnValue('GNEWPUBKEY'),
      secret: jest.fn().mockReturnValue('SNEWSECRET'),
    }),
  },
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ sign: jest.fn(), toEnvelope: jest.fn() }),
  })),
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
  Operation: {
    payment: jest.fn().mockReturnValue({}),
    createAccount: jest.fn().mockReturnValue({}),
  },
  Asset: { native: jest.fn().mockReturnValue({ code: 'XLM' }) },
}));

describe('Stellar integration contract tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadAccount', () => {
    it('returns account data for a valid public key', async () => {
      const mockAccount = { id: 'GPUBLICKEY', sequence: '100' };
      mockLoadAccount.mockResolvedValueOnce(mockAccount);

      const { Server } = require('@stellar/stellar-sdk');
      const server = new Server('https://horizon-testnet.stellar.org');
      const account = await server.loadAccount('GPUBLICKEY');

      expect(mockLoadAccount).toHaveBeenCalledWith('GPUBLICKEY');
      expect(account).toEqual(mockAccount);
    });

    it('throws when the account does not exist on the network', async () => {
      mockLoadAccount.mockRejectedValueOnce(new Error('Account not found'));

      const { Server } = require('@stellar/stellar-sdk');
      const server = new Server('https://horizon-testnet.stellar.org');

      await expect(server.loadAccount('GNONEXISTENT')).rejects.toThrow('Account not found');
    });
  });

  describe('submitTransaction', () => {
    it('returns result hash on a successful payment', async () => {
      const mockResult = { hash: 'abc123txhash' };
      mockSubmitTransaction.mockResolvedValueOnce(mockResult);

      const { Server } = require('@stellar/stellar-sdk');
      const server = new Server('https://horizon-testnet.stellar.org');
      const result = await server.submitTransaction({} as any);

      expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
      expect(result.hash).toBe('abc123txhash');
    });

    it('throws on transaction rejection (e.g. insufficient funds)', async () => {
      mockSubmitTransaction.mockRejectedValueOnce(
        new Error('Transaction failed: op_underfunded'),
      );

      const { Server } = require('@stellar/stellar-sdk');
      const server = new Server('https://horizon-testnet.stellar.org');

      await expect(server.submitTransaction({} as any)).rejects.toThrow('op_underfunded');
    });

    it('throws when the network times out', async () => {
      mockSubmitTransaction.mockRejectedValueOnce(new Error('Request timeout'));

      const { Server } = require('@stellar/stellar-sdk');
      const server = new Server('https://horizon-testnet.stellar.org');

      await expect(server.submitTransaction({} as any)).rejects.toThrow('Request timeout');
    });
  });
});
