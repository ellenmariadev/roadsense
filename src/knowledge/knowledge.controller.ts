import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { KnowledgeArticle, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ArticleListResponseDto, ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { SearchArticlesDto } from './dto/search-articles.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('articles')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create a knowledge article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<KnowledgeArticle> {
    return this.knowledgeService.create(dto, actor);
  }

  @Get('articles')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'List knowledge articles (paginated)' })
  @ApiResponse({ status: HttpStatus.OK, type: ArticleListResponseDto })
  list(@Query() dto: ListArticlesDto): Promise<ArticleListResponseDto> {
    return this.knowledgeService.list(dto);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Search knowledge articles using PostgreSQL full-text search',
    description:
      'Returns sourced results (stable id + title + verbatim snippet). No generated explanation is produced.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: SearchResponseDto })
  search(@Query() dto: SearchArticlesDto): Promise<SearchResponseDto> {
    return this.knowledgeService.search(dto);
  }
}
