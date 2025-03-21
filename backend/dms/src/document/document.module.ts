import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { GraphApiModule } from '@gnx/graphapi';
import { AppLogger } from '@gnx/logger';
import { config } from 'dotenv';
config();


@Module({
  imports:[
    GraphApiModule.forRoot({
      clientId: process.env.CLIENTID,
      clientSecret: process.env.CLIENTSECRET,
      tenantId: process.env.TENANTID,
      msUrl:process.env.MSURL ,
      graphUrl:process.env.GRAPHURL,
      scope:process.env.SCOPE
    })
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
