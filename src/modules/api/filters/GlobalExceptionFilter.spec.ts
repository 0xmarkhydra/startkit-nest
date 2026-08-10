import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './GlobalExceptionFilter';

const createHost = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const request = { method: 'GET', url: '/' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
};

describe('GlobalExceptionFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not duplicate logs for an infrastructure error already logged upstream', () => {
    const filter = new GlobalExceptionFilter(false, false);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, response } = createHost();

    filter.catch(
      new ServiceUnavailableException({
        statusCode: 503,
        message: 'Rate limiting service unavailable',
        error: 'Internal Redis detail',
        suppressErrorLog: true,
      }),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        status_code: 503,
        message: 'Internal server error',
        error_id: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
    expect(response.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
    );
  });

  it('still logs unexpected server errors', () => {
    const filter = new GlobalExceptionFilter(false, false);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host } = createHost();

    filter.catch(new Error('boom'), host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the same snake-case envelope for client errors', () => {
    const filter = new GlobalExceptionFilter(false, false);
    const { host, response } = createHost();

    filter.catch(new BadRequestException('Invalid request'), host);

    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        status_code: 400,
        message: 'Invalid request',
        timestamp: expect.any(String),
      }),
    );
  });
});
