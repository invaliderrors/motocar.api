import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { BaseStoreService } from 'src/lib/base-store.service';

@Injectable()
export class UserService extends BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  create(dto: CreateUserDto, storeId: string) {
    const { storeId: _, ...data } = dto;
    return this.prisma.user.create({ 
      data: {
        ...data,
        store: { connect: { id: storeId } },
      } 
    });
  }

  findAll(userStoreId: string | null) {
    return this.prisma.user.findMany({
      where: this.storeFilter(userStoreId),
    });
  }

  async findOne(id: string, userStoreId: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    
    // Validate store access
    this.validateStoreAccess(user, userStoreId);
    
    return user;
  }

  async update(id: string, dto: UpdateUserDto, userStoreId: string | null) {
    await this.findOne(id, userStoreId);
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async remove(id: string, userStoreId: string | null) {
    await this.findOne(id, userStoreId);
    return this.prisma.user.delete({ where: { id } });
  }
}
