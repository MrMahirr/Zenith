import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('posture_minute_summaries')
export class PostureMinuteSummary {
  @PrimaryColumn({ type: 'datetime' })
  minuteBucket: string;

  @Column({ type: 'integer' })
  eventCount: number;

  @Column({ type: 'integer' })
  slouchCount: number;

  @Column({ type: 'float' })
  avgDistance: number;

  @Column({ type: 'datetime' })
  sourceMaxCreatedAt: string;
}
