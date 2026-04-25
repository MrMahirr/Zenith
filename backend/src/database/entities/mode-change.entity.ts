import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('mode_changes')
export class ModeChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  mode: string;

  @CreateDateColumn()
  createdAt: Date;
}
