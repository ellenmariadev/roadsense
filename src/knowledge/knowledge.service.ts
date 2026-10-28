import { Injectable } from '@nestjs/common';
import { KnowledgeArticle, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleListResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { SearchArticlesDto } from './dto/search-articles.dto';
import { SearchResponseDto, SearchResultItemDto } from './dto/search-response.dto';

interface SearchRow {
  id: string;
  title: string;
  tags: string[];
  relevance: number;
  snippet: string | null;
}

const NO_RESULTS_LIMITATION =
  'No knowledge articles matched the query; the retrieved material does not support an answer.';

/**
 * Full-text search document expression. Content is treated as untrusted data:
 * it is only ever tokenized and returned verbatim, never executed.
 */
const DOCUMENT = `to_tsvector('portuguese', k.title || ' ' || k.content || ' ' || coalesce(array_to_string(k.tags, ' '), ''))`;

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateArticleDto, actor: AuthenticatedUser): Promise<KnowledgeArticle> {
    return this.prisma.knowledgeArticle.create({
      data: {
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
        createdById: actor.id,
      },
    });
  }

  async list(dto: ListArticlesDto): Promise<ArticleListResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.knowledgeArticle.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeArticle.count(),
    ]);

    return { items, total, page, limit };
  }

  async search(dto: SearchArticlesDto): Promise<SearchResponseDto> {
    const query = dto.q.trim();
    const limit = dto.limit ?? 20;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT
        k.id,
        k.title,
        k.tags,
        ts_rank(${Prisma.raw(DOCUMENT)}, websearch_to_tsquery('portuguese', ${query}))::double precision AS relevance,
        ts_headline(
          'portuguese',
          k.content,
          websearch_to_tsquery('portuguese', ${query}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=12'
        ) AS snippet
      FROM "knowledge_articles" AS k
      WHERE ${Prisma.raw(DOCUMENT)} @@ websearch_to_tsquery('portuguese', ${query})
      ORDER BY relevance DESC
      LIMIT ${limit}
    `;

    const results: SearchResultItemDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      relevance: Math.round(row.relevance * 10000) / 10000,
      tags: row.tags ?? [],
    }));

    return {
      query,
      count: results.length,
      results,
      limitation: results.length === 0 ? NO_RESULTS_LIMITATION : null,
    };
  }
}
