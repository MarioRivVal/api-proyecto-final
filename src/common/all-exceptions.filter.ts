import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Todas las respuestas de error salen como { statusCode, code }.
// La web traduce el código ('SLOT_FULL', 'NOT_PENDING'…) a un texto para el usuario.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ statusCode: 500, code: 'INTERNAL_ERROR' });
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string' ? body : (body as { message?: unknown }).message;

    response.status(status).json({
      statusCode: status,
      // Los errores de class-validator llegan como lista de mensajes
      code: typeof message === 'string' ? message : 'VALIDATION_ERROR',
    });
  }
}
