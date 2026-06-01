import { Controller, Get, Param, Query } from '@nestjs/common';
import { CourseDiscoveryService } from './course-discovery.service';

@Controller('courses')
export class CourseDiscoveryController {
  constructor(private readonly discoveryService: CourseDiscoveryService) {}

  /**
   * GET /courses?q=javascript
   * Full-text search using MongoDB $text index.
   * Returns all courses when q is omitted.
   */
  @Get()
  search(@Query('q') query: string) {
    return this.discoveryService.search(query);
  }

  /**
   * GET /courses/:id
   * Retrieve a single course by ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.discoveryService.findOne(id);
  }
}
