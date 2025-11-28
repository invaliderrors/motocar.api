import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "src/prisma/prisma.service"
import { firstValueFrom } from "rxjs"
import * as fs from "fs"
import * as path from "path"
import type { SendMessageDto, SendBase64MediaDto } from "./dto"
import type { AxiosResponse } from "axios"

type SendResult = { success: boolean; messageId?: string; error?: string; raw?: any }

interface StoreWhatsAppConfig {
    apiUrl: string
    instanceId: string
    apiKey: string
}

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name)

    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Get WhatsApp configuration for a specific store
     */
    private async getStoreConfig(storeId: string): Promise<StoreWhatsAppConfig> {
        const store = await this.prisma.store.findUnique({
            where: { id: storeId },
            select: {
                id: true,
                name: true,
                whatsappEnabled: true,
                whatsappInstanceId: true,
                whatsappApiKey: true,
            },
        })

        if (!store) {
            throw new NotFoundException(`Store with ID ${storeId} not found`)
        }

        if (!store.whatsappEnabled) {
            throw new BadRequestException(`WhatsApp is not enabled for store ${store.name}`)
        }

        if (!store.whatsappInstanceId || !store.whatsappApiKey) {
            throw new BadRequestException(
                `WhatsApp configuration incomplete for store ${store.name}. ` +
                `Please configure Instance ID and API Key.`
            )
        }

        // Get API URL from environment variable (shared across all stores)
        const apiUrl = this.config.get<string>("EVOLUTION_API_URL")

        if (!apiUrl) {
            throw new BadRequestException(
                `WhatsApp API URL not configured. ` +
                `Please configure EVOLUTION_API_URL in environment variables.`
            )
        }

        return {
            apiUrl,
            instanceId: store.whatsappInstanceId,
            apiKey: store.whatsappApiKey,
        }
    }

    /**
     * Get status for a specific store's WhatsApp instance
     */
    async getStatus(storeId: string) {
        const config = await this.getStoreConfig(storeId)
        
        return {
            isReady: true,
            info: {
                provider: "evolution-api",
                instance: config.instanceId,
                baseUrl: config.apiUrl,
                storeId,
            },
        }
    }

    // Messaging
    async sendMessage(storeId: string, dto: SendMessageDto): Promise<SendResult> {
        try {
            const config = await this.getStoreConfig(storeId)
            const url = `${config.apiUrl}/message/sendText/${config.instanceId}`
            
            // Backward compatibility: accept legacy { phoneNumber, message }
            const numberRaw: string | undefined = (dto as any)?.number ?? (dto as any)?.phoneNumber
            const textRaw: string | undefined = (dto as any)?.text ?? (dto as any)?.message

            if (!numberRaw) {
                throw new Error("Missing 'number' (or legacy 'phoneNumber') in request body")
            }
            if (!textRaw) {
                throw new Error("Missing 'text' (or legacy 'message') in request body")
            }

            const payload = {
                number: this.normalizeNumber(numberRaw),
                options: { delay: 123, presence: "composing" },
                text: textRaw,
            }

            const { data } = await firstValueFrom<AxiosResponse<any>>(
                this.http.post<any>(url, payload, { headers: this.headers(config.apiKey) })
            )

            return { success: true, messageId: this.extractMessageId(data), raw: data }
        } catch (error: any) {
            if (error?.response?.status === 404) {
                this.logger.error(
                    `404 Not Found calling Evolution API sendText for store ${storeId}. ` +
                    `Check WhatsApp configuration for this store.`
                )
            }
            const msg = error?.response?.data?.message || error?.message || "Unknown error"
            this.logger.error(`Failed to send text for store ${storeId}: ${msg}`)
            return { success: false, error: msg }
        }
    }

    async sendAttachment(storeId: string, phoneNumber: string, filePath: string, caption?: string): Promise<SendResult> {
        try {
            const config = await this.getStoreConfig(storeId)
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`)
            }

            const fileName = path.basename(filePath)
            const media = fs.readFileSync(filePath, { encoding: "base64" })
            const mediaType = this.guessMediaTypeFromExt(fileName)

            const url = `${config.apiUrl}/message/sendMedia/${config.instanceId}`
            const mediaMessage: any = {
                mediatype: mediaType,
                media,
            }
            if (mediaType === "document") {
                mediaMessage.fileName = fileName
            }
            if (caption && mediaType !== "audio") {
                mediaMessage.caption = caption
            }

            const payload = {
                number: this.normalizeNumber(phoneNumber),
                mediaMessage,
            }

            const { data } = await firstValueFrom<AxiosResponse<any>>(
                this.http.post<any>(url, payload, { headers: this.headers(config.apiKey) })
            )
            return { success: true, messageId: this.extractMessageId(data), raw: data }
        } catch (error: any) {
            const resp = error?.response?.data
            const msg = (resp && (resp.message || JSON.stringify(resp))) || error?.message || "Unknown error"
            this.logger.error(`Failed to send media for store ${storeId}: ${msg}`)
            return { success: false, error: msg }
        }
    }

    async sendRemoteAttachment(
        storeId: string,
        phoneNumber: string,
        urlOrFile: string,
        filename: string,
        mimeType: string,
        caption?: string,
    ): Promise<SendResult> {
        try {
            const config = await this.getStoreConfig(storeId)
            
            // Download the file and convert to base64
            const fileResp = await firstValueFrom<AxiosResponse<ArrayBuffer>>(
                this.http.get<ArrayBuffer>(urlOrFile, { responseType: "arraybuffer" as any })
            )
            const base64 = Buffer.from(fileResp.data).toString("base64")
            const mediaType = this.mediaTypeFromMime(mimeType)

            const url = `${config.apiUrl}/message/sendMedia/${config.instanceId}`
            const mediaMessage: any = {
                mediatype: mediaType,
                media: base64,
                mimetype: mimeType,
            }
            if (mediaType === "document") {
                mediaMessage.fileName = filename
            }
            if (caption && mediaType !== "audio") {
                mediaMessage.caption = caption
            }

            const payload = {
                number: this.normalizeNumber(phoneNumber),
                mediaMessage,
            }

            const { data } = await firstValueFrom<AxiosResponse<any>>(
                this.http.post<any>(url, payload, { headers: this.headers(config.apiKey) })
            )
            return { success: true, messageId: this.extractMessageId(data), raw: data }
        } catch (error: any) {
            const resp = error?.response?.data
            const msg = (resp && (resp.message || JSON.stringify(resp))) || error?.message || "Unknown error"
            this.logger.error(`Failed to send remote media for store ${storeId}: ${msg}`)
            return { success: false, error: msg }
        }
    }

    async sendMediaBase64(storeId: string, dto: SendBase64MediaDto): Promise<SendResult> {
        try {
            const config = await this.getStoreConfig(storeId)
            const mediaType = this.mediaTypeFromMime(dto.mimetype || "") || (dto.mediatype as any)
            const url = `${config.apiUrl}/message/sendMedia/${config.instanceId}`
            const payload: any = {
                number: this.normalizeNumber(dto.number),
                mediatype: mediaType,
                media: dto.media,
            }
            if (dto.mimetype) payload.mimetype = dto.mimetype
            if (mediaType === "document") {
                if (!dto.fileName) throw new Error("fileName is required for mediatype=document")
                payload.fileName = dto.fileName
            }
            if (dto.caption && mediaType !== "audio") {
                payload.caption = dto.caption
            }

            const { data } = await firstValueFrom<AxiosResponse<any>>(
                this.http.post<any>(url, payload, { headers: this.headers(config.apiKey) })
            )
            return { success: true, messageId: this.extractMessageId(data), raw: data }
        } catch (error: any) {
            const resp = error?.response?.data
            const msg = (resp && (resp.message || JSON.stringify(resp))) || error?.message || "Unknown error"
            this.logger.error(`Failed to send base64 media for store ${storeId}: ${msg}`)
            return { success: false, error: msg }
        }
    }

    // Helpers
    private headers(apiKey: string) {
        return { apikey: apiKey, "Content-Type": "application/json" }
    }

    private normalizeNumber(phone: string): string {
        // Evolution API expects the international number without '+' or '@c.us'
        if (!phone) {
            throw new Error("Number is required")
        }
        return phone.replace(/\D/g, "")
    }

    private extractMessageId(data: any): string | undefined {
        return (
            data?.id ||
            data?.messageId ||
            data?.message?.id ||
            data?.data?.id ||
            undefined
        )
    }

    private mediaTypeFromMime(mime: string): "image" | "video" | "audio" | "document" {
        if (!mime) return "document"
        if (mime.startsWith("image/")) return "image"
        if (mime.startsWith("video/")) return "video"
        if (mime.startsWith("audio/")) return "audio"
        return "document"
    }

    private guessMediaTypeFromExt(fileName: string): "image" | "video" | "audio" | "document" {
        const ext = path.extname(fileName).toLowerCase()
        if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image"
        if ([".mp4", ".mov", ".mkv", ".webm"].includes(ext)) return "video"
        if ([".mp3", ".ogg", ".wav", ".m4a"].includes(ext)) return "audio"
        return "document"
    }
}
