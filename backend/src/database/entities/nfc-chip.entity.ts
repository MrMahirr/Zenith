import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * NFC Çip Entity
 *
 * Sisteme okutulan her NFC çipin bilgilerini tutar.
 * Çip kayıtlı ise bir moda atanmıştır; kayıtsız ise
 * kullanıcının sisteme eklemesini bekler.
 */
@Entity('nfc_chips')
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
  @Column({ type: 'boolean', default: false })
  isRegistered: boolean;

  /** İlk okunma zamanı */
  @CreateDateColumn()
  firstSeenAt: Date;

  /** Son güncelleme zamanı */
  @UpdateDateColumn()
  updatedAt: Date;

  /** Son okunma zamanı */
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
