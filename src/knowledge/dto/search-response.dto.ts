import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchResultItemDto {
  @ApiProperty({ description: 'Stable source identifier of the knowledge article' })
  id: string;

  @ApiProperty({ description: 'Source title (attribution)' })
  title: string;

  @ApiPropertyOptional({
    description: 'Verbatim excerpt from the article with matched terms highlighted',
  })
  snippet: string | null;

  @ApiProperty({ description: 'Relevance rank (higher is more relevant)' })
  relevance: number;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class SearchResponseDto {
  @ApiProperty()
  query: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [SearchResultItemDto] })
  results: SearchResultItemDto[];

  @ApiPropertyOptional({
    description: 'Explicit limitation when the retrieved material does not support an answer',
  })
  limitation: string | null;
}
