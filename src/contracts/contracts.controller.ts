import {
    Controller,
    Post,
    Body,
    Res,
    HttpCode,
    Header,
} from '@nestjs/common'
import { Response } from 'express'
import { ContractService } from './contracts.service'
import { CreateContractDto } from './dto'
import { Public } from 'src/auth/decorators/public.decorator'
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';


@Controller('contract')
export class ContractController {
    constructor(private readonly contractService: ContractService) { }

    @Post()
    @Public()
    @LogAction(ActionType.CUSTOM, 'Contract', 'Generate contract PDF')
    @HttpCode(200)
    @Header('Content-Type', 'application/pdf')
    @Header('Content-Disposition', 'inline; filename=contract.pdf')
    async generateContract(@Body() dto: CreateContractDto, @Res() res: Response) {
        const pdf = await this.contractService.generateContract(dto)
        res.end(pdf)
    }
}
