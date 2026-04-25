import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PosturGateway } from './postur/postur.gateway';
import { EventsGateway } from './events/events.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PosturGateway, EventsGateway

  ],
})
export class AppModule {}
