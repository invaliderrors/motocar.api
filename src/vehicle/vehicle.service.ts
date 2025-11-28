import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto, FindVehicleFiltersDto } from './vehicle.dto';
import { BaseStoreService } from 'src/lib/base-store.service';
import { Prisma } from 'src/prisma/generated/client';

@Injectable()
export class VehicleService extends BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  create(dto: CreateVehicleDto, storeId: string) {
    const { storeId: _, providerId, soatDueDate, technomechDueDate, ...data } = dto;
    return this.prisma.vehicle.create({ 
      data: {
        ...data,
        soatDueDate: soatDueDate ? new Date(soatDueDate) : undefined,
        technomechDueDate: technomechDueDate ? new Date(technomechDueDate) : undefined,
        store: { connect: { id: storeId } },
        provider: { connect: { id: providerId } },
      } 
    });
  }

  async findAll(filters: FindVehicleFiltersDto = {}, userStoreId: string | null) {
    const {
      search,
      providerId,
      vehicleType,
      brand,
      plate,
      minPrice,
      maxPrice,
      page = 1,
      limit = 50,
    } = filters;

    const where: Prisma.VehicleWhereInput = {
      ...this.storeFilter(userStoreId),
    };

    // Search filter (searches across multiple fields)
    if (search) {
      where.OR = [
        { plate: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { engine: { contains: search, mode: 'insensitive' } },
        { chassis: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Specific filters
    if (providerId) {
      where.providerId = providerId;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (brand) {
      where.brand = { contains: brand, mode: 'insensitive' };
    }

    if (plate) {
      where.plate = { contains: plate, mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    const skip = (page - 1) * limit;

    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        include: {
          provider: true,
          loans: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      data: vehicles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userStoreId: string | null) {
    const vehicle = await this.prisma.vehicle.findUnique({ 
      where: { id },
      include: {
        provider: true,
        loans: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    
    // Validate store access
    this.validateStoreAccess(vehicle, userStoreId);
    
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, userStoreId: string | null) {
    await this.findOne(id, userStoreId);
    const { soatDueDate, technomechDueDate, ...data } = dto;
    return this.prisma.vehicle.update({ 
      where: { id }, 
      data: {
        ...data,
        soatDueDate: soatDueDate ? new Date(soatDueDate) : undefined,
        technomechDueDate: technomechDueDate ? new Date(technomechDueDate) : undefined,
      }
    });
  }

  async remove(id: string, userStoreId: string | null) {
    await this.findOne(id, userStoreId);
    return this.prisma.vehicle.delete({ where: { id } });
  }
}
