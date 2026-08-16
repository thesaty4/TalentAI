import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { HeuristicService } from './heuristic.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers:   [SearchService, LlmService, HeuristicService],
})
export class SearchModule {}
