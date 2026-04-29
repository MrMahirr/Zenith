import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('posture_events')
export class PostureEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean' })
  isSlouching: boolean;

  @Column({ type: 'float' })
  distance: number;

  @Index('idx_posture_events_created_at')
  @CreateDateColumn()
  createdAt: Date;
}
