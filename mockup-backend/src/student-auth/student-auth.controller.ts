import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('student-auth')
@Controller('student-auth')
export class StudentAuthController {
  @Post('register')
  @ApiOperation({ summary: 'Register a student account' })
  @ApiResponse({ status: 201, description: 'Student account created' })
  @ApiResponse({ status: 400, description: 'Invalid registration payload' })
  register(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'register', body };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate a student account' })
  @ApiResponse({ status: 200, description: 'Student authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() body: Record<string, unknown>) {
    return { ok: true, action: 'login', body };
  }
}
