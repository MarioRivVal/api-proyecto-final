import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { EventsService } from '../events/events.service';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { RegistrationsService } from './registrations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminRegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly eventsService: EventsService,
  ) {}

  @Get('events')
  findEvents() {
    return this.eventsService.findAll();
  }

  @Get('events/:slug/registrations')
  findByEvent(@Param('slug') slug: string) {
    return this.registrationsService.findByEvent(slug);
  }

  @Get('events/:slug/registrations.csv')
  async exportCsv(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.registrationsService.exportAccepted(slug);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aceptadas-${slug}.csv"`,
    );
    // Sin esta marca al principio, Excel no lee bien los acentos
    return '\uFEFF' + csv;
  }

  @Post('registrations/:id/accept')
  @HttpCode(200)
  accept(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationsService.accept(id);
  }

  @Post('registrations/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.registrationsService.reject(id, dto.reason);
  }
}
