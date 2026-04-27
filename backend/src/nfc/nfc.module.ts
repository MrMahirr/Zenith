import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfcChip } from '../database/entities/nfc-chip.entity';
import { NfcScanLog } from '../database/entities/nfc-scan-log.entity';
import { NfcService } from './nfc.service';
import { NfcController } from './nfc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NfcChip, NfcScanLog])],
  controllers: [NfcController],
  providers: [NfcService],
  exports: [NfcService],
})
export class NfcModule {}
