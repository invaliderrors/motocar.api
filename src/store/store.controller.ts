import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoreService } from './store.service';
import {
  CreateStoreDto,
  UpdateStoreDto,
  TransferVehicleDto,
  TransferLoanDto,
  ReassignEmployeeDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../prisma/generated/client';
import { CurrentUser } from 'src/auth';

/**
 * Store Controller
 * Handles all store management operations (Admin only)
 */
@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /**
   * Get all stores
   * GET /stores
   */
  @Get()
  findAll() {
    return this.storeService.findAll();
  }

  /**
   * Get admin dashboard overview with all stores stats
   * GET /stores/admin/dashboard
   */
  @Get('admin/dashboard')
  getAdminDashboard() {
    return this.storeService.getAdminDashboard();
  }

  /**
   * Get store by ID
   * GET /stores/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  /**
   * Get store summary with statistics
   * GET /stores/:id/summary
   */
  @Get(':id/summary')
  getStoreSummary(@Param('id') id: string) {
    return this.storeService.getStoreSummary(id);
  }

  /**
   * Create new store
   * POST /stores
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createStoreDto: CreateStoreDto) {
    return this.storeService.create(createStoreDto);
  }

  /**
   * Update store
   * PATCH /stores/:id
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storeService.update(id, updateStoreDto);
  }

  /**
   * Delete store (soft delete - sets archived)
   * DELETE /stores/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.storeService.remove(id);
  }

  /**
   * Transfer vehicle between stores
   * POST /stores/transfer/vehicle/:vehicleId
   */
  @Post('transfer/vehicle/:vehicleId')
  async transferVehicle(
    @Param('vehicleId') vehicleId: string,
    @Body() transferDto: TransferVehicleDto,
    @CurrentUser() user: User,
  ) {
    await this.storeService.transferVehicle(
      vehicleId,
      transferDto.targetStoreId,
      transferDto.reason,
      user.id,
    );
    return { message: 'Vehicle transferred successfully' };
  }

  /**
   * Transfer loan between stores
   * POST /stores/transfer/loan/:loanId
   */
  @Post('transfer/loan/:loanId')
  async transferLoan(
    @Param('loanId') loanId: string,
    @Body() transferDto: TransferLoanDto,
    @CurrentUser() user: User,
  ) {
    await this.storeService.transferLoan(
      loanId,
      transferDto.targetStoreId,
      transferDto.reason,
      user.id,
    );
    return { message: 'Loan transferred successfully' };
  }

  /**
   * Reassign employee to different store
   * POST /stores/transfer/employee/:employeeId
   */
  @Post('transfer/employee/:employeeId')
  async reassignEmployee(
    @Param('employeeId') employeeId: string,
    @Body() reassignDto: ReassignEmployeeDto,
    @CurrentUser() user: User,
  ) {
    await this.storeService.reassignEmployee(
      employeeId,
      reassignDto.newStoreId,
      reassignDto.reason,
      user.id,
    );
    return { message: 'Employee reassigned successfully' };
  }

  /**
   * Get store WhatsApp configuration
   * GET /stores/:id/whatsapp-config
   */
  @Get(':id/whatsapp-config')
  getWhatsAppConfig(@Param('id') id: string) {
    return this.storeService.getWhatsAppConfig(id);
  }

  /**
   * Update store WhatsApp configuration
   * PATCH /stores/:id/whatsapp-config
   */
  @Patch(':id/whatsapp-config')
  updateWhatsAppConfig(
    @Param('id') id: string,
    @Body() config: {
      whatsappEnabled: boolean;
      whatsappApiUrl?: string;
      whatsappInstanceId?: string;
      whatsappApiKey?: string;
    },
  ) {
    return this.storeService.updateWhatsAppConfig(id, config);
  }
}
