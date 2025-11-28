import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto, QueryNewsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  create(@Body() createNewsDto: CreateNewsDto, @Request() req: any) {
    return this.newsService.create(createNewsDto, req.user.sub);
  }

  @Get()
  findAll(@Query() query: QueryNewsDto) {
    return this.newsService.findAll(query);
  }

  @Get('loan/:loanId/active')
  getActiveLoanNews(@Param('loanId') loanId: string) {
    return this.newsService.getActiveLoanNews(loanId);
  }

  @Get('store/:storeId/active')
  getActiveStoreNews(@Param('storeId') storeId: string) {
    return this.newsService.getActiveStoreNews(storeId);
  }

  @Get('loan/:loanId/total-installments-to-subtract')
  getTotalInstallmentsToSubtract(@Param('loanId') loanId: string) {
    return this.newsService.getTotalInstallmentsToSubtract(loanId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNewsDto: UpdateNewsDto) {
    return this.newsService.update(id, updateNewsDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
