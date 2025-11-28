import { Controller, Post, Get, Body, UseInterceptors, UploadedFile, Req, Query } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import type { Express } from "express"
import type { SendMessageDto, SendAttachmentDto, SendRemoteAttachmentDto, SendBase64MediaDto } from "./dto"
import { WhatsappService } from "./whatsapp.service"
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';

@Controller("whatsapp")
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Get("status")
    @LogAction(ActionType.QUERY, 'WhatsApp', 'Get WhatsApp status')
    async getStatus(@Query('storeId') storeId: string, @Req() req: any) {
        // ADMIN can check any store's status, EMPLOYEE can only check their own store
        const requestStoreId = storeId || req.user?.storeId
        if (!requestStoreId) {
            throw new Error('storeId is required')
        }
        
        // If user is EMPLOYEE, validate they can only access their own store
        if (req.user?.role === 'EMPLOYEE' && req.user?.storeId !== requestStoreId) {
            throw new Error('Unauthorized: Cannot access another store\'s WhatsApp status')
        }
        
        return this.whatsappService.getStatus(requestStoreId)
    }

    @Post("send-message")
    @LogAction(ActionType.CUSTOM, 'WhatsApp', 'Send WhatsApp message')
    async sendMessage(@Body() sendMessageDto: SendMessageDto, @Req() req: any) {
        // Use storeId from authenticated user (EMPLOYEE) or require in body for ADMIN
        const storeId = req.user?.storeId || (sendMessageDto as any).storeId
        if (!storeId) {
            throw new Error('storeId is required')
        }
        
        // If user is EMPLOYEE, validate they can only send from their own store
        if (req.user?.role === 'EMPLOYEE' && req.user?.storeId !== storeId) {
            throw new Error('Unauthorized: Cannot send messages from another store')
        }
        
        return this.whatsappService.sendMessage(storeId, sendMessageDto)
    }

    @Post("send-attachment")
    @UseInterceptors(FileInterceptor("file"))
    @LogAction(ActionType.CUSTOM, 'WhatsApp', 'Send WhatsApp attachment')
    async sendAttachment(@UploadedFile() file: Express.Multer.File, @Body() sendAttachmentDto: SendAttachmentDto, @Req() req: any) {
        const storeId = req.user?.storeId || (sendAttachmentDto as any).storeId
        if (!storeId) {
            throw new Error('storeId is required')
        }
        
        if (req.user?.role === 'EMPLOYEE' && req.user?.storeId !== storeId) {
            throw new Error('Unauthorized: Cannot send attachments from another store')
        }
        
        return this.whatsappService.sendAttachment(storeId, sendAttachmentDto.number, file.path, sendAttachmentDto.caption)
    }

    @Post("send-remote-attachment")
    @LogAction(ActionType.CUSTOM, 'WhatsApp', 'Send remote attachment')
    async sendRemoteAttachment(@Body() dto: SendRemoteAttachmentDto, @Req() req: any) {
        const storeId = req.user?.storeId || (dto as any).storeId
        if (!storeId) {
            throw new Error('storeId is required')
        }
        
        if (req.user?.role === 'EMPLOYEE' && req.user?.storeId !== storeId) {
            throw new Error('Unauthorized: Cannot send remote attachments from another store')
        }
        
        return this.whatsappService.sendRemoteAttachment(storeId, dto.number, dto.url, dto.filename, dto.mimeType, dto.caption)
    }

    @Post("send-media-base64")
    @LogAction(ActionType.CUSTOM, 'WhatsApp', 'Send media base64')
    async sendMediaBase64(@Body() dto: SendBase64MediaDto, @Req() req: any) {
        const storeId = req.user?.storeId || (dto as any).storeId
        if (!storeId) {
            throw new Error('storeId is required')
        }
        
        if (req.user?.role === 'EMPLOYEE' && req.user?.storeId !== storeId) {
            throw new Error('Unauthorized: Cannot send base64 media from another store')
        }
        
        return this.whatsappService.sendMediaBase64(storeId, dto)
    }
}

