import { IsOptional, IsUUID } from 'class-validator';

export class CreateProviderDto {
    /**
     * The name of the provider.
     */
    name: string;

    @IsOptional()
    @IsUUID()
    storeId?: string;
}
