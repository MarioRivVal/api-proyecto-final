import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module';
import { Slot } from '../events/slot.entity';
import { AdminRegistrationsController } from './admin-registrations.controller';
import { MyRegistrationsController } from './my-registrations.controller';
import { Registration } from './registration.entity';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [EventsModule, TypeOrmModule.forFeature([Registration, Slot])],
  controllers: [MyRegistrationsController, AdminRegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
