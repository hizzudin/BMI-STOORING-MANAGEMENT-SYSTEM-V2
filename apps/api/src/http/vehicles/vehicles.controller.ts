import {
  VehicleDeactivateRequestSchema,
  VehicleListResponseSchema,
  VehicleRequestSchema,
  VehicleResponseSchema,
  VehicleUpdateRequestSchema,
  type VehicleDeactivateRequest,
  type VehicleListResponse,
  type VehicleRequest,
  type VehicleResponse,
  type VehicleUpdateRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  VehicleConflictError,
  VehicleInvalidError,
  VehicleNotFoundError,
  VehicleService,
} from '../../core/fleet/vehicle-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const One = { name: 'VehicleResponse', schema: VehicleResponseSchema };

/** REQ-VEH-001 to REQ-VEH-004: Vehicles; reading needs vehicle.view, writing vehicle.manage. */
@Controller('vehicles')
@UseGuards(SessionGuard)
export class VehiclesController {
  constructor(@Inject(VehicleService) private readonly vehicles: VehicleService) {}

  @Get()
  @RequireCapability('vehicle.view', 'vehicle.manage')
  @ApiContract({
    operationId: 'listVehicles',
    summary: 'Vehicles with their class, layout and allowed actions',
    response: { name: 'VehicleListResponse', schema: VehicleListResponseSchema },
  })
  list(@CurrentSession() session: SignedIn): Promise<VehicleListResponse> {
    return this.vehicles.list(actorOf(session));
  }

  @Get(':id')
  @RequireCapability('vehicle.view', 'vehicle.manage')
  @ApiContract({ operationId: 'getVehicle', summary: 'One vehicle', response: One })
  async get(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VehicleResponse> {
    return { vehicle: await this.vehicles.get(actorOf(session), id) };
  }

  @Post()
  @RequireCapability('vehicle.manage')
  @ApiContract({
    operationId: 'createVehicle',
    summary: 'Add a vehicle (REQ-VEH-002)',
    body: { name: 'VehicleRequest', schema: VehicleRequestSchema },
    response: One,
  })
  async create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: VehicleRequest,
  ): Promise<VehicleResponse> {
    return { vehicle: await this.vehicles.create(actorOf(session), body) };
  }

  @Patch(':id')
  @RequireCapability('vehicle.manage')
  @ApiContract({
    operationId: 'updateVehicle',
    summary: 'Edit a vehicle with a reason (REQ-VEH-003)',
    body: { name: 'VehicleUpdateRequest', schema: VehicleUpdateRequestSchema },
    response: One,
  })
  async update(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: VehicleUpdateRequest,
  ): Promise<VehicleResponse> {
    return { vehicle: await this.vehicles.update(actorOf(session), id, body) };
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequireCapability('vehicle.manage')
  @ApiContract({
    operationId: 'deactivateVehicle',
    summary: 'Deactivate a vehicle with a reason (REQ-VEH-004)',
    body: { name: 'VehicleDeactivateRequest', schema: VehicleDeactivateRequestSchema },
    response: One,
  })
  async deactivate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: VehicleDeactivateRequest,
  ): Promise<VehicleResponse> {
    return { vehicle: await this.vehicles.deactivate(actorOf(session), id, body) };
  }
}

/** 400, 404 and 409 of the vehicle routes, each with one sentence. */
@Catch(VehicleNotFoundError, VehicleConflictError, VehicleInvalidError)
export class VehicleErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof VehicleNotFoundError
        ? HttpStatus.NOT_FOUND
        : error instanceof VehicleConflictError
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
