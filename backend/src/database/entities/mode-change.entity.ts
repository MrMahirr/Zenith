import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('mode_changes')
export class ModeChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  mode: string;

  @Index('idx_mode_changes_created_at')
  @CreateDateColumn()
  createdAt: Date;
}
