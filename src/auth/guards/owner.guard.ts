import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class IsOwnerGuard implements CanActivate {
    constructor(private readonly getOwnerIdFromParam: (ctx: ExecutionContext) => string) { }

    canActivate(ctx: ExecutionContext): boolean {
        const request = ctx.switchToHttp().getRequest();
        const userId = request.user?.sub;
        const targetId = this.getOwnerIdFromParam(ctx);

        if (userId !== targetId) {
            throw new ForbiddenException('No tienes permiso para acceder a este recurso.');
        }

        return true;
    }
}
