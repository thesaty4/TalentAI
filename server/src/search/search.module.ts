import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { HeuristicService } from './heuristic.service';
import { EmbeddingService } from './embedding.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers:   [SearchService, LlmService, HeuristicService, EmbeddingService],
})
export class SearchModule {}
