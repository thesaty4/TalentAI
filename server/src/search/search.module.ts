import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { HeuristicService } from './heuristic.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers:   [SearchService, GeminiService, HeuristicService],
})
export class SearchModule {}
