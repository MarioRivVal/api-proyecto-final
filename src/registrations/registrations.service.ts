import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { EventsService } from '../events/events.service';
import { Slot } from '../events/slot.entity';
import { Registration } from './registration.entity';
import { RegistrationStatus } from './registration-status';

const UNIQUE_VIOLATION = '23505';

function madridTime(date: Date) {
  return date.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private readonly registrationsRepository: Repository<Registration>,
    @InjectRepository(Slot)
    private readonly slotsRepository: Repository<Slot>,
    private readonly eventsService: EventsService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Atleta ----------

  findMine(userId: string) {
    return this.registrationsRepository.find({
      where: { userId },
      relations: { event: true, slot: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, slotId: string) {
    const slot = await this.slotsRepository.findOneBy({ id: slotId });
    if (!slot) throw new NotFoundException('NOT_FOUND');

    const event = await this.eventsService.findCurrent();
    if (
      slot.eventId !== event.id ||
      !this.eventsService.isRegistrationOpen(event)
    ) {
      throw new UnprocessableEntityException('REGISTRATION_CLOSED');
    }

    const accepted = await this.registrationsRepository.countBy({
      slotId,
      status: RegistrationStatus.Accepted,
    });
    if (accepted >= slot.capacity) throw new ConflictException('SLOT_FULL');

    try {
      return await this.registrationsRepository.save({
        eventId: event.id,
        slotId,
        userId,
        status: RegistrationStatus.Pending,
      });
    } catch (error) {
      // El índice único de la base no deja tener dos solicitudes activas en la misma edición
      const code = (error as QueryFailedError<Error & { code?: string }>)
        .driverError?.code;
      if (code === UNIQUE_VIOLATION) {
        throw new ConflictException('ALREADY_HAS_ACTIVE');
      }
      throw error;
    }
  }

  async withdraw(userId: string, id: string) {
    const registration = await this.findPending({ id, userId });
    registration.status = RegistrationStatus.Withdrawn;
    registration.decidedAt = new Date();
    return this.registrationsRepository.save(registration);
  }

  // ---------- Organizador ----------

  async findByEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    const accepted = await this.eventsService.countAcceptedBySlot(event.id);
    const registrations = await this.registrationsRepository.find({
      where: { eventId: event.id },
      relations: { user: true },
      // Las más recientes primero: son las que el organizador busca
      order: { createdAt: 'DESC' },
    });

    return {
      event: {
        slug: event.slug,
        name: event.name,
        edition: event.edition,
        startsOn: event.startsOn,
      },
      slots: event.slots.map((slot) => ({
        id: slot.id,
        code: slot.code,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        capacity: slot.capacity,
        accepted: accepted.get(slot.id) ?? 0,
        registrations: registrations
          .filter((registration) => registration.slotId === slot.id)
          .map(({ user, ...registration }) => ({
            id: registration.id,
            status: registration.status,
            rejectionReason: registration.rejectionReason,
            createdAt: registration.createdAt,
            decidedAt: registration.decidedAt,
            athlete: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone,
              sex: user.sex,
              shirtSize: user.shirtSize,
            },
          })),
      })),
    };
  }

  // Bloquea la solicitud y su turno hasta terminar: si dos organizadores aceptan a la vez
  // el último hueco, el segundo espera y después ve el turno lleno
  accept(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const registration = await manager.findOne(Registration, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!registration) throw new NotFoundException('NOT_FOUND');
      if (registration.status !== RegistrationStatus.Pending) {
        throw new ConflictException('NOT_PENDING');
      }

      const slot = await manager.findOneOrFail(Slot, {
        where: { id: registration.slotId },
        lock: { mode: 'pessimistic_write' },
      });
      const accepted = await manager.countBy(Registration, {
        slotId: slot.id,
        status: RegistrationStatus.Accepted,
      });
      if (accepted >= slot.capacity) throw new ConflictException('SLOT_FULL');

      registration.status = RegistrationStatus.Accepted;
      registration.decidedAt = new Date();
      return manager.save(registration);
    });
  }

  async reject(id: string, reason?: string) {
    const registration = await this.findPending({ id });
    registration.status = RegistrationStatus.Rejected;
    registration.rejectionReason = reason || null;
    registration.decidedAt = new Date();
    return this.registrationsRepository.save(registration);
  }

  async exportAccepted(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    const registrations = await this.registrationsRepository.find({
      where: { eventId: event.id, status: RegistrationStatus.Accepted },
      relations: { user: true, slot: true },
      order: { slot: { startsAt: 'ASC' }, user: { lastName: 'ASC' } },
    });

    const header = 'Turno;Nombre;Apellidos;Email;Teléfono;Sexo;Talla';
    const lines = registrations.map(({ slot, user }) =>
      [
        madridTime(slot.startsAt),
        user.firstName,
        user.lastName,
        user.email,
        user.phone ?? '',
        user.sex === 'FEMALE' ? 'Mujer' : 'Hombre',
        user.shirtSize ?? '',
      ].join(';'),
    );
    return [header, ...lines].join('\n');
  }

  private async findPending(where: FindOptionsWhere<Registration>) {
    const registration = await this.registrationsRepository.findOneBy(where);
    if (!registration) throw new NotFoundException('NOT_FOUND');
    if (registration.status !== RegistrationStatus.Pending) {
      throw new ConflictException('NOT_PENDING');
    }
    return registration;
  }
}
