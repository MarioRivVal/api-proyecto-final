import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Event } from '../events/event.entity';
import { Slot } from '../events/slot.entity';
import { User } from '../users/user.entity';
import { Registration } from './registration.entity';
import { RegistrationStatus } from './registration-status';
import { RegistrationsModule } from './registrations.module';
import { RegistrationsService } from './registrations.service';

// Contra la base de test de docker-compose (docker compose up -d db-test)
describe('RegistrationsService (PostgreSQL real)', () => {
  let service: RegistrationsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5453,
          username: 'fortenow',
          password: 'fortenow_test',
          database: 'fortenow_test',
          entities: [User, Event, Slot, Registration],
          migrations: [join(__dirname, '..', 'migrations', '*.ts')],
          dropSchema: true,
          migrationsRun: true,
        }),
        RegistrationsModule,
      ],
    }).compile();

    service = moduleRef.get(RegistrationsService);
    dataSource = moduleRef.get(DataSource);
  }, 30_000);

  afterAll(() => dataSource.destroy());

  it('con 10 aceptaciones a la vez sobre 1 plaza, solo entra una', async () => {
    const event = await dataSource.getRepository(Event).save({
      slug: 'test-2027',
      name: 'TEST',
      edition: 2027,
      startsOn: '2027-03-13',
      venueName: 'Box',
      venueAddress: 'Calle',
      registrationOpensAt: new Date('2026-01-01'),
      registrationClosesAt: new Date('2027-03-11'),
    });
    const slot = await dataSource.getRepository(Slot).save({
      eventId: event.id,
      code: '1000',
      startsAt: new Date('2027-03-13T09:00:00Z'),
      endsAt: new Date('2027-03-13T09:45:00Z'),
      capacity: 1,
    });

    const pendingIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const user = await dataSource.getRepository(User).save({
        email: `atleta${i}@example.com`,
        passwordHash: 'x',
        role: 'ATHLETE',
        firstName: 'Atleta',
        lastName: `${i}`,
      });
      const registration = await dataSource.getRepository(Registration).save({
        eventId: event.id,
        slotId: slot.id,
        userId: user.id,
        status: RegistrationStatus.Pending,
      });
      pendingIds.push(registration.id);
    }

    // Se abren antes las 10 conexiones. Si no, la primera aceptación termina mientras las
    // demás aún se conectan, nunca coinciden y el test no probaría nada
    await Promise.all(
      pendingIds.map(() => dataSource.query('SELECT pg_sleep(0.1)')),
    );

    const results = await Promise.allSettled(
      pendingIds.map((id) => service.accept(id)),
    );

    const accepted = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    rejected.forEach((result) => {
      expect(result.reason).toBeInstanceOf(ConflictException);
    });

    const acceptedInDb = await dataSource.getRepository(Registration).countBy({
      slotId: slot.id,
      status: RegistrationStatus.Accepted,
    });
    expect(acceptedInDb).toBe(1);
  });
});
