import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('sensor_minute_summaries')
export class SensorMinuteSummary {
  @PrimaryColumn({ type: 'datetime' })
  minuteBucket: string;

  @Column({ type: 'float' })
  avgTemperature: number;

  @Column({ type: 'float' })
  avgHumidity: number;

  @Column({ type: 'float' })
  avgPressure: number;

  @Column({ type: 'float', nullable: true })
  avgAirQuality: number;

  @Column({ type: 'float', nullable: true })
  avgGasVoltage: number;

  @Column({ type: 'integer' })
  sampleCount: number;

  @Column({ type: 'datetime' })
  sourceMaxCreatedAt: string;
}
