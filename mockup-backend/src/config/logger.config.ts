import { LoggerModule } from 'nestjs-pino';

export const loggerConfig = LoggerModule.forRoot({
  pinoHttp: {
    redact: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'req.body.token',
      'req.body.refreshToken',
      'req.headers.cookie',
    ],
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
});
