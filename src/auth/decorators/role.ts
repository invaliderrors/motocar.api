import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentRole = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();
        return request.user?.roles?.[0] ?? 'USER';
    },
);
