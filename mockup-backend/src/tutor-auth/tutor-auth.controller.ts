import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('tutor-auth')
@Controller('auth/tutor')
export class TutorAuthController {
  @Post('register')
  @ApiOperation({ summary: 'Register a tutor account' })
  @ApiResponse({ status: 201, description: 'Tutor account created' })
  @ApiResponse({ status: 400, description: 'Invalid registration payload' })
  register(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'register', body };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate a tutor account' })
  @ApiResponse({ status: 200, description: 'Tutor authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'login', body };
  }
}
