import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

// pdf-parse and mammoth have no @types packages — require + manual cast
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth  = require('mammoth') as { extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }> };

const PDF_MIME  = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@ApiTags('search')
@ApiBearerAuth()
@Roles(Role.manager, Role.hr)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'AI-ranked candidate matches for an open IRC' })
  search(@CurrentUser() user: JwtPayload, @Body() dto: SearchDto) {
    return this.searchService.search(user, dto);
  }

  @Post('upload-jd')
  @ApiOperation({ summary: 'Upload PDF/DOCX JD → extract text → run search (R11)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'ircId', 'scope'],
      properties: {
        file:  { type: 'string', format: 'binary' },
        ircId: { type: 'integer' },
        scope: { type: 'string', enum: ['all', 'applied'] },
        query: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      // Silently reject disallowed types; controller checks for missing file
      fileFilter: (_req, file, cb) => cb(null, [PDF_MIME, DOCX_MIME].includes(file.mimetype)),
    }),
  )
  async uploadJd(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SearchDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('PDF or DOCX file required (R11)');

    const jdText = file.mimetype === PDF_MIME
      ? (await pdfParse(file.buffer)).text
      : (await mammoth.extractRawText({ buffer: file.buffer })).value;

    return this.searchService.search(user, { ...dto, jdText }, file.originalname);
  }
}
