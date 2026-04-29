import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * NFC Çip Entity
 *
 * Sisteme okutulan her NFC çipin bilgilerini tutar.
 * Çip kayıtlı ise bir moda atanmıştır; kayıtsız ise
 * kullanıcının sisteme eklemesini bekler.
 */
@Entity('nfc_chips')
@Index('idx_nfc_chips_registered_last_seen', ['isRegistered', 'lastSeenAt'])
export class NfcChip {
  @PrimaryGeneratedColumn()
  id: number;

  /** Çipin benzersiz UID'si (hex formatında, ör. "AA:BB:CC:DD") */
  @Column({ type: 'varchar', length: 50, unique: true })
  uid: string;

  /** Kullanıcının verdiği etiket (ör. "Kodlama Kartım") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  /** Atanan mod: CODING, FOCUS, RELAX, MEETING, PASSIVE veya null */
  @Column({ type: 'varchar', length: 20, nullable: true })
  assignedMode: string | null;

  /** Çip sisteme kayıtlı mı? */
  @Index('idx_nfc_chips_is_registered')
  @Column({ type: 'boolean', default: false })
  isRegistered: boolean;

  /** İlk okunma zamanı */
  @CreateDateColumn()
  firstSeenAt: Date;

  /** Son güncelleme zamanı */
  @UpdateDateColumn()
  updatedAt: Date;

  /** Son okunma zamanı */
  @Index('idx_nfc_chips_last_seen_at')
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
