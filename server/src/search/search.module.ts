import { Module } from '@nestjs/common';
import { LlamaService } from './llama.service';
import { HeuristicService } from './heuristic.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers:   [SearchService, LlamaService, HeuristicService],
})
export class SearchModule {}
