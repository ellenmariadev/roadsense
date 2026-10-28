import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/incidents' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps body-parser payload errors to a safe 413 response', () => {
    const { host, status, json } = createHost();
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
        message: 'Payload too large',
        error: 'Payload Too Large',
        path: '/api/v1/incidents',
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('stack');
  });

  it('preserves normal HttpException responses', () => {
    const { host, status, json } = createHost();
    filter.catch(new BadRequestException('Invalid input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'Invalid input' }),
    );
  });

  it('hides unexpected internal errors', () => {
    const { host, status, json } = createHost();
    filter.catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('password');
  });
});
