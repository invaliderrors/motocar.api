import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function main() {
  if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
  }
  const app = await NestFactory.create(AppModule);
  
  // Enable shutdown hooks to properly disconnect from database
  app.enableShutdownHooks();
  
  const config = app.get<ConfigService>(ConfigService);
  const port = config.get<number>('PORT') || 3000;
  const host = config.get<string>('HOST') || '0.0.0.0';

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix(`api/${config.get<string>('API_VERSION')}`);
  app.useWebSocketAdapter(new IoAdapter(app))
  if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads", { recursive: true })
  }

  if (!fs.existsSync("./.wwebjs_auth")) {
    fs.mkdirSync("./.wwebjs_auth", { recursive: true })
    fs.chmodSync("./.wwebjs_auth", 0o777)
  }

  app.enableCors({
    origin: '*',
  });
  await app.listen(port, host);
}
main();
