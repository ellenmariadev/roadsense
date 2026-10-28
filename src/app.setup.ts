import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { globalValidationPipe } from './common/pipes/global-validation.pipe';

export interface AppSetupOptions {
  swagger?: boolean;
}

export function configureApp(app: INestApplication, options: AppSetupOptions = {}): void {
  const { swagger = true } = options;
  const configService = app.get(ConfigService);
  const globalPrefix = configService.get<string>('app.globalPrefix', 'api/v1');

  const expressApp = app as NestExpressApplication;
  expressApp.useBodyParser('json', { limit: '100kb' });
  expressApp.useBodyParser('urlencoded', { limit: '100kb', extended: true });

  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();

  if (swagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Road Sense API')
      .setDescription(
        'Local-first road incident intelligence platform. Incidents, AI-assisted triage (mock or OpenAI), health and readiness.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }
}
