import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NewsService } from '../news/news.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService, NewsService],
  exports: [ReportsService],
})
export class ReportsModule {}
