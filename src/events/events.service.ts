import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from '../registrations/registration.entity';
import { RegistrationStatus } from '../registrations/registration-status';
import { Event } from './event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationsRepository: Repository<Registration>,
  ) {}

  findAll() {
    return this.eventsRepository.find({ order: { startsOn: 'DESC' } });
  }

  // La edición actual es la más reciente; las demás solo se consultan
  async findCurrent() {
    const [event] = await this.eventsRepository.find({
      relations: { slots: true },
      order: { startsOn: 'DESC', slots: { startsAt: 'ASC' } },
      take: 1,
    });
    if (!event) throw new NotFoundException('NOT_FOUND');
    return event;
  }

  async findBySlug(slug: string) {
    const event = await this.eventsRepository.findOne({
      where: { slug },
      relations: { slots: true },
      order: { slots: { startsAt: 'ASC' } },
    });
    if (!event) throw new NotFoundException('NOT_FOUND');
    return event;
  }

  isRegistrationOpen(event: Event) {
    const now = new Date();
    return (
      now >= event.registrationOpensAt && now <= event.registrationClosesAt
    );
  }

  // Solo las aceptadas ocupan plaza. Devuelve cuántas tiene cada turno: slotId → número
  async countAcceptedBySlot(eventId: string) {
    const rows = await this.registrationsRepository
      .createQueryBuilder('registration')
      .select('registration.slotId', 'slotId')
      .addSelect('COUNT(*)', 'accepted')
      .where('registration.eventId = :eventId', { eventId })
      .andWhere('registration.status = :status', {
        status: RegistrationStatus.Accepted,
      })
      .groupBy('registration.slotId')
      .getRawMany<{ slotId: string; accepted: string }>();

    return new Map(rows.map((row) => [row.slotId, Number(row.accepted)]));
  }

  async findCurrentWithPlaces() {
    const event = await this.findCurrent();
    const accepted = await this.countAcceptedBySlot(event.id);

    return {
      ...event,
      registrationOpen: this.isRegistrationOpen(event),
      slots: event.slots.map((slot) => ({
        ...slot,
        freePlaces: slot.capacity - (accepted.get(slot.id) ?? 0),
      })),
    };
  }
}
