import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { Slot } from '../events/slot.entity';
import { User } from '../users/user.entity';
import { RegistrationStatus } from './registration-status';

// Una solicitud activa por atleta y edición. Lo garantiza la base, no solo el código
@Index('UQ_registrations_active_per_event', ['userId', 'eventId'], {
  unique: true,
  where: `"status" IN ('PENDING', 'ACCEPTED')`,
})
@Entity('registrations')
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Repetido (ya está en el turno) para poder poner el índice de arriba
  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'uuid' })
  slotId: string;

  @ManyToOne(() => Slot)
  @JoinColumn({ name: 'slotId' })
  slot: Slot;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  status: RegistrationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
