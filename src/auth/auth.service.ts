import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/prisma/generated/client';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole; // Changed from roles array to single role
  storeId: string | null; // null for ADMIN, storeId for EMPLOYEE
  storeName?: string; // Optional: for display purposes
  storeCode?: string; // Optional: for display purposes
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) { }

  async validateUser(username: string, pass: string) {
    const user = await this.prisma.employee.findUnique({ where: { username } });
    if (!user) return null;

    const match = await bcrypt.compare(pass, user.passwordHash);
    if (!match) return null;

    const { passwordHash, refreshToken, ...safe } = user;
    return safe;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // Fetch store information if user is an EMPLOYEE
    let store: { id: string; name: string; code: string; nit: string; city: string } | null = null;
    if (user.storeId) {
      store = await this.prisma.store.findUnique({
        where: { id: user.storeId },
        select: { id: true, name: true, code: true, nit: true, city: true },
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      storeName: store?.name,
      storeCode: store?.code,
    };

    const access_token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') || '15m',
    });

    const refresh_token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    const hashedRT = await bcrypt.hash(refresh_token, 10);

    await this.prisma.employee.update({
      where: { id: user.id },
      data: {
        lastAccess: new Date(),
        refreshToken: hashedRT,
      },
    });

    return {
      access_token,
      refresh_token,
      user: {
        ...user,
        store,
      },
    };
  }

  async register(name: string, username: string, password: string, role: UserRole = UserRole.EMPLOYEE, storeId?: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.employee.create({
      data: {
        name,
        username,
        passwordHash,
        role,
        storeId: storeId || null,
        status: 'ACTIVE',
      },
    });
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch (e) {
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Token no registrado');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new ForbiddenException('Token inválido');
    }


    const newPayload: JwtPayload = {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      storeId: payload.storeId,
      storeName: payload.storeName,
      storeCode: payload.storeCode,
    };


    const newAccessToken = await this.jwt.signAsync(newPayload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') || '15m',
    });


    const newRefreshToken = await this.jwt.signAsync(newPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    const hashedNewRefreshToken = await bcrypt.hash(newRefreshToken, 10);

    await this.prisma.employee.update({
      where: { id: payload.sub },
      data: { refreshToken: hashedNewRefreshToken },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }


  async logout(userId: string) {
    return this.prisma.employee.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
