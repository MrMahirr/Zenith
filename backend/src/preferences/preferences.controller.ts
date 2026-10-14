import { Body, Controller, Get, Put } from '@nestjs/common';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesService } from './preferences.service';

/**
 * Kullanıcı tercihleri REST API'si.
 * Prefix: /api/preferences
 */
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  /** Tercihler, varsayılanlar ve izin verilen aralıklar. */
  @Get()
  async get() {
    return this.preferences.getView();
  }

  /** Kısmi güncelleme; `null` alanı varsayılana döndürür. */
  @Put()
  async update(@Body() body: UpdatePreferencesDto) {
    // ValidationPipe (whitelist) yalnızca bildirilen alanları bırakır; gönderilmeyen
    // alan `undefined` kalır ve dokunulmaz.
    await this.preferences.update({ ...body });
    return this.preferences.getView();
  }
}
