import { KnowledgeArticle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from './knowledge.service';

function createFakePrisma() {
  const knowledgeArticle = {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
  return {
    knowledgeArticle,
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    $queryRaw: jest.fn(),
  };
}

function article(overrides: Partial<KnowledgeArticle> = {}): KnowledgeArticle {
  return {
    id: 'a1',
    title: 'Procedimento de teste',
    content: 'Conteúdo de teste sobre resgate.',
    tags: ['resgate'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    ...overrides,
  } as KnowledgeArticle;
}

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new KnowledgeService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('persists an article with normalized tags', async () => {
      prisma.knowledgeArticle.create.mockResolvedValue(article());

      const actor = { id: 'actor-1', email: 'a@b.c', name: null, role: 'OPERATOR' as const };

      await service.create({ title: 'T', content: 'C' }, actor);

      expect(prisma.knowledgeArticle.create).toHaveBeenCalledWith({
        data: { title: 'T', content: 'C', tags: [], createdById: 'actor-1' },
      });
    });
  });

  describe('list', () => {
    it('returns paginated items with total', async () => {
      const item = article();
      prisma.knowledgeArticle.findMany.mockResolvedValue([item]);
      prisma.knowledgeArticle.count.mockResolvedValue(1);

      const result = await service.list({ page: 2, limit: 5 });

      expect(prisma.knowledgeArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result).toEqual({ items: [item], total: 1, page: 2, limit: 5 });
    });
  });

  describe('search', () => {
    it('maps raw rows into sourced results and rounds relevance', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'a1', title: 'T1', tags: ['x'], relevance: 0.12345, snippet: '<mark>resgate</mark>' },
      ]);

      const result = await service.search({ q: 'resgate' });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.results).toEqual([
        { id: 'a1', title: 'T1', snippet: '<mark>resgate</mark>', relevance: 0.1235, tags: ['x'] },
      ]);
      expect(result.count).toBe(1);
      expect(result.limitation).toBeNull();
    });

    it('returns an explicit limitation when no material is found', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.search({ q: 'termo-inexistente' });

      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.limitation).toMatch(/does not support an answer/);
    });
  });
});
