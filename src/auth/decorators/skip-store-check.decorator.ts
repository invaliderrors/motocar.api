import { SetMetadata } from '@nestjs/common';
import { SKIP_STORE_CHECK_KEY } from '../guards/store-access.guard';

/**
 * Decorator to skip store access validation for specific routes
 * Use this for routes that need to access data across all stores (admin-only routes)
 */
export const SkipStoreCheck = () => SetMetadata(SKIP_STORE_CHECK_KEY, true);
