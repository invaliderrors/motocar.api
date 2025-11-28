import { IsString, IsDateString } from 'class-validator'

export class CreateContractDto {
    /** Número del contrato */
    @IsString()
    contractNumber: string

    /** Nombre del representante legal */
    @IsString()
    legalRepresentative: string

    /** Cédula del representante legal */
    @IsString()
    representativeId: string

    /** Nombre del cliente */
    @IsString()
    customerName: string

    /** Cédula del cliente */
    @IsString()
    customerId: string

    @IsString()
    customerCity: string;

    /** Dirección del cliente */
    @IsString()
    customerAddress: string

    /** Teléfono del cliente */
    @IsString()
    customerPhone: string

    /** Placa del vehículo */
    @IsString()
    plate: string

    /** Marca del vehículo */
    @IsString()
    brand: string

    /** Motor del vehículo */
    @IsString()
    engine: string

    /** Modelo del vehículo */
    @IsString()
    model: string

    /** Chasis del vehículo */
    @IsString()
    chassis: string

    /** Fecha del contrato (formato ISO) */
    @IsDateString()
    date: string
}
