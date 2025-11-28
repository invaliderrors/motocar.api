import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  ForbiddenException,
  Get,
  Param,
} from '@nestjs/common';
import { AuthService, JwtPayload } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { RegisterDto, LoginDto } from './data/dto';
import { Request as Req } from 'express';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/user';
import { CurrentRole } from './decorators/role';
import { IsOwner } from './decorators/owner';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }


  @Post('register')
  @LogAction(ActionType.CREATE, 'User', 'User registration')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.name, dto.username, dto.password, dto.role, dto.storeId);
  }

  @Public()
  @Post('login')
  @LogAction(ActionType.CUSTOM, 'Auth', 'User login')
  login(@Body() { username, password }: LoginDto) {
    return this.auth.login(username, password);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  @Post('me')
  @LogAction(ActionType.QUERY, 'User', 'Get user profile')
  profile(@Request() req: Req) {
    return req.user;
  }

  @Public()
  @Post('refresh')
  @LogAction(ActionType.CUSTOM, 'Auth', 'Refresh token')
  async refresh(@Body() body: { refresh_token: string }) {
    if (!body.refresh_token) {
      throw new ForbiddenException('Refresh token requerido');
    }
    return this.auth.refresh(body.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @LogAction(ActionType.CUSTOM, 'Auth', 'User logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.auth.logout(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin-action')
  @LogAction(ActionType.CUSTOM, 'Auth', 'Admin action')
  adminAction() {
    return { ok: true, msg: 'You’re an admin!' };
  }

  @Post('test-role')
  @UseGuards(JwtAuthGuard)
  @LogAction(ActionType.QUERY, 'User', 'Test user role')
  testRole(@CurrentRole() role: string) {
    return { role };
  }

  @Get('profile/:id')
  @UseGuards(JwtAuthGuard)
  @IsOwner('id')
  @LogAction(ActionType.QUERY, 'User', 'Get user profile by ID')
  getProfile(@Param('id') id: string) {
    return { msg: `Accediendo al perfil del owner ${id}` };
  }
}
