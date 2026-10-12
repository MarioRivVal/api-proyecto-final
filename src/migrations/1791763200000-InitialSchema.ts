import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791763200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL UNIQUE,
        "passwordHash" text NOT NULL,
        "role" text NOT NULL CHECK ("role" IN ('ATHLETE', 'ADMIN')),
        "firstName" text NOT NULL,
        "lastName" text NOT NULL,
        "phone" text,
        "sex" text CHECK ("sex" IN ('MALE', 'FEMALE')),
        "shirtSize" text CHECK ("shirtSize" IN ('S', 'M', 'L', 'XL', 'XXL')),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" text NOT NULL UNIQUE,
        "name" text NOT NULL,
        "edition" int NOT NULL,
        "startsOn" date NOT NULL,
        "venueName" text NOT NULL,
        "venueAddress" text NOT NULL,
        "registrationOpensAt" timestamptz NOT NULL,
        "registrationClosesAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CHECK ("registrationClosesAt" > "registrationOpensAt")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "slots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL REFERENCES "events" ("id") ON DELETE RESTRICT,
        "code" text NOT NULL,
        "startsAt" timestamptz NOT NULL,
        "endsAt" timestamptz NOT NULL,
        "capacity" int NOT NULL CHECK ("capacity" > 0),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("eventId", "code"),
        CHECK ("endsAt" > "startsAt")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "registrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "eventId" uuid NOT NULL REFERENCES "events" ("id") ON DELETE RESTRICT,
        "slotId" uuid NOT NULL REFERENCES "slots" ("id") ON DELETE RESTRICT,
        "userId" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
        "status" text NOT NULL
          CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
        "rejectionReason" text,
        "decidedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_registrations_active_per_event"
        ON "registrations" ("userId", "eventId")
        WHERE "status" IN ('PENDING', 'ACCEPTED')
    `);

    // Para contar las aceptadas de cada turno
    await queryRunner.query(`
      CREATE INDEX "IDX_registrations_slot_status"
        ON "registrations" ("slotId", "status")
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE "registrations"`);
    await queryRunner.query(`DROP TABLE "slots"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
