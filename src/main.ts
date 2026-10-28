import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.globalPrefix', 'api/v1');
  const port = configService.get<number>('app.port', 3000);

  await app.listen(port);

  Logger.log(`Application listening on http://localhost:${port}/${globalPrefix}`, 'Bootstrap');
  Logger.log(`Swagger UI available at http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
