import { Module } from '@nestjs/common';
import { HeuristicService } from './heuristic.service';
import { LlamaService } from './llama.service';
import { RetrievalService } from './retrieval.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers:   [SearchService, HeuristicService, RetrievalService, LlamaService],
})
export class SearchModule {}
