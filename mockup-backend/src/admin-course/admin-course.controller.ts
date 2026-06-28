import { Controller, Get, Query } from '@nestjs/common';
import { AdminCourseService } from './admin-course.service';

@Controller('admin/courses')
export class AdminCourseController {
  constructor(private readonly adminCourseService: AdminCourseService) {}

  /**
   * GET /admin/courses?page=1&limit=20
   *
   * Returns a paginated envelope:
   *   { data, total, page, limit }
   *
   * Defaults: page=1, limit=20
   * Maximum enforced limit: 50 (enforced in the service layer)
   */
  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminCourseService.findAll(Number(page), Number(limit));
  }
}
