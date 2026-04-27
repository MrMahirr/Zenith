import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { NfcService } from './nfc.service';

/**
 * NFC Controller
 *
 * NFC çip yönetimi REST API endpoint'leri.
 * Prefix: /api/nfc
 */
@Controller('nfc')
export class NfcController {
  constructor(private readonly nfcService: NfcService) {}

  /** Tüm çipleri listele */
  @Get('chips')
  async getAllChips() {
    return this.nfcService.getAllChips();
  }

  /** Kayıtsız çipleri listele */
  @Get('chips/unregistered')
  async getUnregisteredChips() {
    return this.nfcService.getUnregisteredChips();
  }

  /** Kayıtlı çipleri listele */
  @Get('chips/registered')
  async getRegisteredChips() {
    return this.nfcService.getRegisteredChips();
  }

  /** Çipi sisteme kaydet (etiket ve mod ata) */
  @Patch('chips/:id/register')
  async registerChip(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { label: string; assignedMode: string },
  ) {
    return this.nfcService.registerChip(id, body.label, body.assignedMode);
  }

  /** Çip bilgilerini güncelle */
  @Patch('chips/:id')
  async updateChip(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { label?: string; assignedMode?: string },
  ) {
    return this.nfcService.updateChip(id, body);
  }

  /** Çipi sil */
  @Delete('chips/:id')
  async deleteChip(@Param('id', ParseIntPipe) id: number) {
    await this.nfcService.deleteChip(id);
    return { success: true };
  }

  /** Okuma loglarını getir */
  @Get('logs')
  async getScanLogs(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.nfcService.getScanLogs(h);
  }
}
