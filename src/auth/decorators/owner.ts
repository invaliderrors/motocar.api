import { applyDecorators, UseGuards } from '@nestjs/common';
import { IsOwnerGuard } from '../guards/owner.guard';


export function IsOwner(paramKey: string = 'id') {
    return applyDecorators(
        UseGuards(new IsOwnerGuard((ctx) => {
            const request = ctx.switchToHttp().getRequest();
            return request.params[paramKey];
        })),
    );
}
