import {
  InternalServerErrorException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { contractOf } from './contract.js';

/** A response leaves only in the shape of its contract: unknown fields are dropped, a wrong shape is a 500. */
export class ContractInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contract = contractOf(context.getHandler());
    return next.handle().pipe(
      map((value: unknown) => {
        if (!contract) return value;
        const result = contract.response.schema.safeParse(value);
        if (result.success) return result.data;
        throw new InternalServerErrorException(
          `The response of ${contract.operationId} breaks its contract`,
        );
      }),
    );
  }
}
