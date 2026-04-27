import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * NFC Okuma Logu Entity
 *
 * Her NFC okuma işlemini kaydeder.
 * Çip bilgisinden ayrı tutulur (SRP) – böylece çip silinse bile
 * okuma geçmişi korunur.
 */
@Entity('nfc_scan_logs')
export class NfcScanLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** Okunan çipin UID'si */
  @Column({ type: 'varchar', length: 50 })
  chipUid: string;

  /** Tetiklenen mod (null = kayıtsız çip, mod tetiklenmedi) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  triggeredMode: string | null;

  /** Okuma anında çip kayıtlı mıydı? */
  @Column({ type: 'boolean', default: false })
  wasRegistered: boolean;

  /** Okuma zamanı */
  @CreateDateColumn()
  scannedAt: Date;
}
