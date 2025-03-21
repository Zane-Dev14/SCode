import { Module } from '@nestjs/common';
import { DocumentModule } from './document/document.module';
import { AppLogger, HttpLoggerInterceptor} from '@gnx/logger';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeUtilsModule } from '@gnx/database';
import { Dialect } from 'sequelize';
import { config } from 'dotenv';
import { Sites } from './document/entities/sites.entity';
import { Drives } from './document/entities/drives.entity';
import { Resources } from './document/entities/resources.entity';
import { ErrorHandlerModule } from '@gnx/error-handler';
config();

@Module({
  imports: [ErrorHandlerModule,
    DocumentModule,
    SequelizeUtilsModule.forRoot({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) ,
      username: process.env.DB_USERNAME ,
      password: process.env.DB_PASSWORD ,
      database: process.env.DB_NAME ,
      entities: [Sites,Drives,Resources],
      dialect: process.env.DB_DIALECT as Dialect || 'postgres',
      secretManager: process.env.SECRET_PATH
    }),
  ],
  providers: [
    {
      provide: AppLogger,
      useFactory: () => {
        const logger = new AppLogger(AppModule.name);  
        logger.log('Initializing dms service...');      
        logger.log(process.env.DB_DIALECT);  
        return logger;
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggerInterceptor,
    },
  ],
  exports: [AppLogger],
})
export class AppModule {
}
