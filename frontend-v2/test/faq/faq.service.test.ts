import { vi, describe, it, expect, beforeEach } from 'vitest';

interface Faq {
  _id: string;
  question: string;
  answer: string;
}

// Minimal FAQ service backed by a mockable model
class FaqService {
  constructor(private model: {
    find: () => Promise<Faq[]>;
    create: (data: Omit<Faq, '_id'>) => Promise<Faq>;
    findByIdAndUpdate: (id: string, data: Partial<Faq>) => Promise<Faq | null>;
    findByIdAndDelete: (id: string) => Promise<Faq | null>;
  }) {}

  getAll() { return this.model.find(); }
  create(q: string, a: string) { return this.model.create({ question: q, answer: a }); }
  update(id: string, data: Partial<Faq>) { return this.model.findByIdAndUpdate(id, data); }
  delete(id: string) { return this.model.findByIdAndDelete(id); }
}

describe('FaqService', () => {
  const mockModel = {
    find: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  };
  let service: FaqService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FaqService(mockModel);
  });

  it('getAll calls model.find', async () => {
    mockModel.find.mockResolvedValueOnce([]);
    await service.getAll();
    expect(mockModel.find).toHaveBeenCalledOnce();
  });

  it('create calls model.create with question and answer', async () => {
    const faq = { _id: '1', question: 'Q?', answer: 'A.' };
    mockModel.create.mockResolvedValueOnce(faq);
    const result = await service.create('Q?', 'A.');
    expect(mockModel.create).toHaveBeenCalledWith({ question: 'Q?', answer: 'A.' });
    expect(result).toEqual(faq);
  });

  it('update calls findByIdAndUpdate', async () => {
    mockModel.findByIdAndUpdate.mockResolvedValueOnce(null);
    await service.update('1', { answer: 'new' });
    expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith('1', { answer: 'new' });
  });

  it('delete calls findByIdAndDelete', async () => {
    mockModel.findByIdAndDelete.mockResolvedValueOnce(null);
    await service.delete('1');
    expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('1');
  });
});