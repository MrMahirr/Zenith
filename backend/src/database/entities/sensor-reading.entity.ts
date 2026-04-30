import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float' })
  temperature: number;

  @Column({ type: 'float' })
  humidity: number;

  @Column({ type: 'float' })
  pressure: number;

  @Column({ type: 'float', nullable: true })
  airQuality: number;

  @Column({ type: 'float', nullable: true })
  gasVoltage: number;

  @Index('idx_sensor_readings_created_at')
  @CreateDateColumn()
  createdAt: Date;
}
