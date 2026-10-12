import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { SessionUser } from '../auth/session-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsService } from './registrations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ATHLETE')
@Controller('me/registrations')
export class MyRegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get()
  findMine(@CurrentUser() user: SessionUser) {
    return this.registrationsService.findMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateRegistrationDto) {
    return this.registrationsService.create(user.id, dto.slotId);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.registrationsService.withdraw(user.id, id);
  }
}
