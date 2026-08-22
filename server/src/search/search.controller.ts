import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EmbeddingService } from './embedding.service';
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

// pdf-parse and mammoth have no @types packages — require + manual cast
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth  = require('mammoth') as { extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }> };

const PDF_MIME  = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ALLOWED_MIMES = [PDF_MIME, DOCX_MIME];

@ApiTags('search')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService:    SearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'AI-ranked candidate matches for an open IRC' })
  search(@CurrentUser() user: JwtPayload, @Body() dto: SearchDto) {
    return this.searchService.search(user, dto);
  }

  @Post('upload-jd')
  @ApiOperation({ summary: 'Upload 1–5 PDF/DOCX JD files → extract text → run search (R11)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'ircId', 'scope'],
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        ircId: { type: 'integer' },
        scope: { type: 'string', enum: ['all', 'applied'] },
        query: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIMES.includes(file.mimetype)),
    }),
  )
  async uploadJd(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SearchDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('At least one PDF or DOCX file is required (R11)');

    // Extract text from each file; concatenate with a separator so context is clear
    const texts = await Promise.all(files.map(f =>
      f.mimetype === PDF_MIME
        ? pdfParse(f.buffer).then(r => r.text)
        : mammoth.extractRawText({ buffer: f.buffer }).then(r => r.value),
    ));
    const jdText      = texts.join('\n\n---\n\n');
    const filenames   = files.map(f => f.originalname).join(', ');

    return this.searchService.search(user, { ...dto, jdText }, filenames);
  }

  @Post('embed-all')
  @Roles(Role.hr)
  @ApiOperation({ summary: 'Bulk re-embed all employee profiles for pgvector RAG pre-filter' })
  embedAll() {
    return this.embeddingService.embedAll();
  }
}
