import { Module } from '@nestjs/common';
import { ServiceRegistry } from './service-registry.service';

@Module({
  providers: [ServiceRegistry],
  exports: [ServiceRegistry],
})
export class StatusModule {}
