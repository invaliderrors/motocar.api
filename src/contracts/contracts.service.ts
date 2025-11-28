import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { CreateContractDto } from './dto';
import { contractTemplate } from './contract';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ContractService {
    async generateContract(dto: CreateContractDto): Promise<Buffer> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        const html = this.fillTemplate(dto);
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm',
            },
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    }

    private fillTemplate(dto: CreateContractDto): string {
        const data = {
            ...dto,
            date: this.formatDate(dto.date),
        };

        return contractTemplate
            .replace(/{{contractNumber}}/g, data.contractNumber)
            .replace(/{{legalRepresentative}}/g, data.legalRepresentative)
            .replace(/{{representativeId}}/g, data.representativeId)
            .replace(/{{customerName}}/g, data.customerName)
            .replace(/{{customerId}}/g, data.customerId)
            .replace(/{{customerCity}}/g, data.customerCity)
            .replace(/{{customerAddress}}/g, data.customerAddress)
            .replace(/{{customerPhone}}/g, data.customerPhone)
            .replace(/{{plate}}/g, data.plate)
            .replace(/{{brand}}/g, data.brand)
            .replace(/{{engine}}/g, data.engine)
            .replace(/{{model}}/g, data.model)
            .replace(/{{chassis}}/g, data.chassis)
            .replace(/{{date}}/g, data.date);
    }

    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        }).format(date);
    }
}
