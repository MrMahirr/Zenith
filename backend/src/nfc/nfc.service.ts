import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { NfcChip } from '../database/entities/nfc-chip.entity';
import { NfcScanLog } from '../database/entities/nfc-scan-log.entity';

/**
 * NFC Service
 *
 * NFC çip CRUD işlemleri ve okuma logları yönetimi.
 * Mod değişimi sorumluluğu ModeService'dedir (SRP).
 */
@Injectable()
export class NfcService {
  private readonly logger = new Logger(NfcService.name);

  constructor(
    @InjectRepository(NfcChip)
    private readonly chipRepo: Repository<NfcChip>,

    @InjectRepository(NfcScanLog)
    private readonly scanLogRepo: Repository<NfcScanLog>,
  ) {}

  // ──────────── CHIP SCAN ────────────

  /**
   * Çip okunduğunda çağrılır.
   * - DB'de varsa lastSeenAt güncellenir
   * - DB'de yoksa yeni kayıt oluşturulur (isRegistered=false)
   * - Her durumda okuma logu kaydedilir
   *
   * @returns Çip bilgisi ve kayıtlı olup olmadığı
   */
  async handleChipScan(uid: string): Promise<{
    chip: NfcChip;
    isNew: boolean;
  }> {
    const normalizedUid = uid.toUpperCase().trim();
    let chip = await this.chipRepo.findOne({ where: { uid: normalizedUid } });
    let isNew = false;

    if (chip) {
      // Mevcut çip – lastSeenAt güncelle
      chip.lastSeenAt = new Date();
      await this.chipRepo.save(chip);
      this.logger.log(`Çip okundu (mevcut): ${normalizedUid}`);
    } else {
      // Yeni çip – kayıtsız olarak ekle
      chip = this.chipRepo.create({
        uid: normalizedUid,
        isRegistered: false,
        lastSeenAt: new Date(),
      });
      chip = await this.chipRepo.save(chip);
      isNew = true;
      this.logger.log(`Yeni çip tespit edildi: ${normalizedUid}`);
    }

    // Okuma logu kaydet
    const log = this.scanLogRepo.create({
      chipUid: normalizedUid,
      triggeredMode: chip.isRegistered ? chip.assignedMode : null,
      wasRegistered: chip.isRegistered,
    });
    await this.scanLogRepo.save(log);

    return { chip, isNew };
  }

  // ──────────── CHIP CRUD ────────────

  /** Tüm çipleri listele */
  async getAllChips(): Promise<NfcChip[]> {
    return this.chipRepo.find({
      order: { lastSeenAt: 'DESC' },
    });
  }

  /** Sadece kayıtsız çipleri listele */
  async getUnregisteredChips(): Promise<NfcChip[]> {
    return this.chipRepo.find({
      where: { isRegistered: false },
      order: { lastSeenAt: 'DESC' },
    });
  }

  /** Sadece kayıtlı çipleri listele */
  async getRegisteredChips(): Promise<NfcChip[]> {
    return this.chipRepo.find({
      where: { isRegistered: true },
      order: { lastSeenAt: 'DESC' },
    });
  }

  /** ID ile çip getir */
  async getChipById(id: number): Promise<NfcChip> {
    const chip = await this.chipRepo.findOne({ where: { id } });
    if (!chip) {
      throw new NotFoundException(`Çip bulunamadı: ID ${id}`);
    }
    return chip;
  }

  /**
   * Çipi sisteme kaydet (etiket ve mod ata)
   */
  async registerChip(
    id: number,
    label: string,
    assignedMode: string,
  ): Promise<NfcChip> {
    const chip = await this.getChipById(id);

    chip.label = label;
    chip.assignedMode = assignedMode;
    chip.isRegistered = true;

    const saved = await this.chipRepo.save(chip);
    this.logger.log(
      `Çip kaydedildi: ${chip.uid} → ${assignedMode} (${label})`,
    );
    return saved;
  }

  /**
   * Çip bilgilerini güncelle (mod veya etiket değiştir)
   */
  async updateChip(
    id: number,
    data: { label?: string; assignedMode?: string },
  ): Promise<NfcChip> {
    const chip = await this.getChipById(id);

    if (data.label !== undefined) {
      chip.label = data.label;
    }
    if (data.assignedMode !== undefined) {
      chip.assignedMode = data.assignedMode;
    }

    const saved = await this.chipRepo.save(chip);
    this.logger.log(`Çip güncellendi: ${chip.uid}`);
    return saved;
  }

  /** Çipi sil */
  async deleteChip(id: number): Promise<void> {
    const chip = await this.getChipById(id);
    await this.chipRepo.remove(chip);
    this.logger.log(`Çip silindi: ${chip.uid}`);
  }

  // ──────────── SCAN LOGS ────────────

  /** Okuma loglarını getir */
  async getScanLogs(hours: number = 24): Promise<NfcScanLog[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.scanLogRepo.find({
      where: { scannedAt: MoreThanOrEqual(since) },
      order: { scannedAt: 'DESC' },
      take: 50, // En fazla 50 log
    });
  }
}
