import { Controller, Get, Post, Body, Param, Put, Delete, Patch, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  @Get()
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.QUERY, 'Employee')
  list() {
    return this.employeeService.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.CREATE, 'Employee')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Employee')
  findById(@Param('id') id: string) {
    return this.employeeService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.UPDATE, 'Employee')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.UPDATE, 'Employee')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.employeeService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Employee')
  delete(@Param('id') id: string) {
    return this.employeeService.delete(id);
  }
}
