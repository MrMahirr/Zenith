import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('posture_events')
export class PostureEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean' })
  isSlouching: boolean;

  @Column({ type: 'float' })
  distance: number;

  @CreateDateColumn()
  createdAt: Date;
}
