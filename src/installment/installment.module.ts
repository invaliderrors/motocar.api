import { Module } from '@nestjs/common';
import { InstallmentService } from './installment.service';
import { InstallmentController } from './installment.controller';
import { NewsService } from '../news/news.service';

@Module({
  providers: [InstallmentService, NewsService],
  controllers: [InstallmentController],
})
export class InstallmentModule {}
