import { ArgumentsHost, ServiceUnavailableException } from '@nestjs/common';
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
  it('does not duplicate logs for an infrastructure error already logged upstream', () => {
    const filter = new GlobalExceptionFilter(false, false);
    const logger = (filter as any).logger;
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const { host, response } = createHost();

    filter.catch(
      new ServiceUnavailableException({
        statusCode: 503,
        message: 'Rate limiting service unavailable',
        suppressErrorLog: true,
      }),
      host,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        message: 'Internal server error',
        errorId: expect.any(String),
      }),
    );
  });

  it('still logs unexpected server errors', () => {
    const filter = new GlobalExceptionFilter(false, false);
    const logger = (filter as any).logger;
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const { host } = createHost();

    filter.catch(new Error('boom'), host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
