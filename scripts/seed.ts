import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from '../src/data-source';
import { Event } from '../src/events/event.entity';
import { Slot } from '../src/events/slot.entity';
import { Registration } from '../src/registrations/registration.entity';
import { RegistrationStatus } from '../src/registrations/registration-status';
import { User } from '../src/users/user.entity';
import { readCsv } from './read-csv';

const users = readCsv('users.csv');
const events = readCsv('events.csv');
const slots = readCsv('slots.csv');
const registrations = readCsv('registrations.csv');

const ONE_DAY = 24 * 60 * 60 * 1000;

// Los CSV traen la hora de Madrid; en la base todo va en UTC.
// El desfase se mira a mediodía de ese día: +01:00 en invierno y +02:00 en verano.
function madridToUtc(date: string, time: string) {
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')
    ?.value.replace('GMT', '');
  return new Date(`${date}T${time}:00${offset}`);
}

// '2023-10-05 18:22' → Date
function madridDateTime(value: string) {
  const [date, time] = value.split(' ');
  return madridToUtc(date, time);
}

function validate() {
  const errors: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };

  const athletes = new Set<string>();
  const emails = new Set<string>();
  users.forEach((user, i) => {
    const row = `users.csv fila ${i + 2}`;
    check(!emails.has(user.email), `${row}: email repetido`);
    emails.add(user.email);
    check(['ATHLETE', 'ADMIN'].includes(user.role), `${row}: rol desconocido`);
    if (user.role === 'ATHLETE') {
      athletes.add(user.email);
      check(['MALE', 'FEMALE'].includes(user.sex), `${row}: sexo desconocido`);
      check(
        ['S', 'M', 'L', 'XL', 'XXL'].includes(user.shirtSize),
        `${row}: talla desconocida`,
      );
    }
  });
  check(
    users.filter((user) => user.role === 'ADMIN').length === 1,
    'users.csv: tiene que haber un solo ADMIN',
  );

  events.forEach((event, i) => {
    check(
      event.registrationClosesAt > event.registrationOpensAt,
      `events.csv fila ${i + 2}: el plazo cierra antes de abrir`,
    );
  });

  const capacities = new Map<string, number>();
  slots.forEach((slot, i) => {
    const row = `slots.csv fila ${i + 2}`;
    const key = `${slot.eventSlug}/${slot.code}`;
    check(
      events.some((event) => event.slug === slot.eventSlug),
      `${row}: no existe la edición ${slot.eventSlug}`,
    );
    check(!capacities.has(key), `${row}: turno repetido ${key}`);
    check(slot.endsAt > slot.startsAt, `${row}: termina antes de empezar`);
    check(Number(slot.capacity) > 0, `${row}: aforo no válido`);
    capacities.set(key, Number(slot.capacity));
  });

  // La edición actual es la más reciente; en las anteriores no puede quedar nada pendiente
  const currentSlug = [...events].sort((a, b) =>
    b.startsOn.localeCompare(a.startsOn),
  )[0].slug;

  const accepted = new Map<string, number>();
  const active = new Set<string>();
  registrations.forEach((registration, i) => {
    const row = `registrations.csv fila ${i + 2}`;
    const slotKey = `${registration.eventSlug}/${registration.slotCode}`;
    const event = events.find((e) => e.slug === registration.eventSlug);

    check(
      athletes.has(registration.userEmail),
      `${row}: ${registration.userEmail} no es un atleta`,
    );
    check(capacities.has(slotKey), `${row}: no existe el turno ${slotKey}`);
    check(
      Object.values<string>(RegistrationStatus).includes(registration.status),
      `${row}: estado desconocido`,
    );
    check(
      event !== undefined &&
        registration.createdAt >= event.registrationOpensAt &&
        registration.createdAt <= event.registrationClosesAt,
      `${row}: fecha fuera del plazo de la edición`,
    );
    check(
      registration.status !== 'PENDING' ||
        registration.eventSlug === currentSlug,
      `${row}: PENDING en una edición anterior`,
    );

    if (registration.status === 'ACCEPTED') {
      accepted.set(slotKey, (accepted.get(slotKey) ?? 0) + 1);
      check(
        accepted.get(slotKey)! <= (capacities.get(slotKey) ?? 0),
        `${row}: el turno ${slotKey} ya está completo`,
      );
    }

    if (['PENDING', 'ACCEPTED'].includes(registration.status)) {
      const key = `${registration.userEmail}/${registration.eventSlug}`;
      check(!active.has(key), `${row}: segunda solicitud activa de ${key}`);
      active.add(key);
    }
  });

  return errors;
}

async function seed() {
  const athletePassword = process.env.SEED_ATHLETE_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!athletePassword || !adminPassword) {
    throw new Error(
      'Faltan SEED_ATHLETE_PASSWORD o SEED_ADMIN_PASSWORD en .env',
    );
  }

  const errors = validate();
  if (errors.length > 0) {
    console.error(`Los CSV tienen ${errors.length} errores:`);
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error('No se ha tocado la base.');
    process.exit(1);
  }

  await dataSource.initialize();

  await dataSource.transaction(async (manager) => {
    await manager.query('TRUNCATE "registrations", "slots", "events", "users"');

    // Todos los atletas comparten contraseña: se cifra una vez
    const athleteHash = await bcrypt.hash(athletePassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const savedUsers = await manager.save(
      User,
      users.map((user) => ({
        email: user.email.toLowerCase(),
        passwordHash: user.role === 'ADMIN' ? adminHash : athleteHash,
        role: user.role as User['role'],
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || null,
        sex: (user.sex || null) as User['sex'],
        shirtSize: (user.shirtSize || null) as User['shirtSize'],
      })),
    );
    const userIds = new Map(savedUsers.map((user) => [user.email, user.id]));

    const savedEvents = await manager.save(
      Event,
      events.map((event) => ({
        slug: event.slug,
        name: event.name,
        edition: Number(event.edition),
        startsOn: event.startsOn,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        registrationOpensAt: madridDateTime(event.registrationOpensAt),
        registrationClosesAt: madridDateTime(event.registrationClosesAt),
      })),
    );
    const eventsBySlug = new Map(
      savedEvents.map((event) => [event.slug, event]),
    );

    const savedSlots = await manager.save(
      Slot,
      slots.map((slot) => {
        const event = eventsBySlug.get(slot.eventSlug)!;
        return {
          eventId: event.id,
          code: slot.code,
          startsAt: madridToUtc(event.startsOn, slot.startsAt),
          endsAt: madridToUtc(event.startsOn, slot.endsAt),
          capacity: Number(slot.capacity),
        };
      }),
    );
    const slotIds = new Map(
      savedSlots.map((slot, i) => [
        `${slots[i].eventSlug}/${slot.code}`,
        slot.id,
      ]),
    );

    await manager.save(
      Registration,
      registrations.map((registration) => {
        const createdAt = madridDateTime(registration.createdAt);
        const status = registration.status as RegistrationStatus;
        return {
          eventId: eventsBySlug.get(registration.eventSlug)!.id,
          slotId: slotIds.get(
            `${registration.eventSlug}/${registration.slotCode}`,
          )!,
          userId: userIds.get(registration.userEmail.toLowerCase())!,
          status,
          rejectionReason: registration.rejectionReason || null,
          createdAt,
          // El CSV no trae cuándo se decidió: se pone un día después, nunca en el futuro
          decidedAt:
            status === RegistrationStatus.Pending
              ? null
              : new Date(Math.min(createdAt.getTime() + ONE_DAY, Date.now())),
        };
      }),
    );
  });

  console.log('Seed terminado:');
  console.table({
    users: users.length,
    events: events.length,
    slots: slots.length,
    registrations: registrations.length,
  });

  await dataSource.destroy();
}

void seed();
