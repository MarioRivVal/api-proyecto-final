import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Slot } from './slot.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  slug: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'int' })
  edition: number;

  // Solo el día, sin hora: 'YYYY-MM-DD'
  @Column({ type: 'date' })
  startsOn: string;

  @Column({ type: 'text' })
  venueName: string;

  @Column({ type: 'text' })
  venueAddress: string;

  @Column({ type: 'timestamptz' })
  registrationOpensAt: Date;

  @Column({ type: 'timestamptz' })
  registrationClosesAt: Date;

  @OneToMany(() => Slot, (slot) => slot.event)
  slots: Slot[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
