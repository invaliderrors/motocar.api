import { JwtPayload } from 'src/auth/auth.service';

declare module 'express' {
    interface Request {
        user: JwtPayload; 
    }
}
