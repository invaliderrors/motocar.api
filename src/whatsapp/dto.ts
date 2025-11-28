import { IsNotEmpty, IsOptional, IsString, IsUrl, Matches } from "class-validator"

export class SendAttachmentDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^\+?[0-9]{10,15}$/, {
        message: "Phone number must be between 10 and 15 digits, optionally starting with +",
    })
    number: string

    @IsOptional()
    @IsString()
    caption?: string
}

export class SendMessageDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^\+?[0-9]{10,15}$/, {
        message: "Phone number must be between 10 and 15 digits, optionally starting with +",
    })
    number: string

    @IsNotEmpty()
    @IsString()
    text: string
}

export class SendRemoteAttachmentDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^\+?[0-9]{10,15}$/, {
        message: "Phone number must be between 10 and 15 digits, optionally starting with +",
    })
    number: string

    @IsNotEmpty()
    @IsUrl()
    url: string

    @IsNotEmpty()
    @IsString()
    filename: string

    @IsNotEmpty()
    @IsString()
    mimeType: string

    @IsOptional()
    @IsString()
    caption?: string
}

export class SendBase64MediaDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^\+?[0-9]{10,15}$/, {
        message: "Phone number must be between 10 and 15 digits, optionally starting with +",
    })
    number: string

    // Evolution expects mediaMessage.mediaType; we accept 'mediatype' in payload and map it
    @IsNotEmpty()
    @IsString()
    mediatype: string // image | video | document | audio

    @IsOptional()
    @IsString()
    mimetype?: string

    @IsOptional()
    @IsString()
    caption?: string

    @IsNotEmpty()
    @IsString()
    media: string // pure base64 without data URI prefix

    @IsOptional()
    @IsString()
    fileName?: string // required for document
}
