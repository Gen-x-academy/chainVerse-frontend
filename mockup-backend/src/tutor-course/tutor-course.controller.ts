import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { TutorCourseService, TutorCourseAttrs } from './tutor-course.service';

@Controller('tutor/courses')
export class TutorCourseController {
  constructor(private readonly tutorCourseService: TutorCourseService) {}

  @Post()
  create(@Body() dto: Omit<TutorCourseAttrs, 'tutorId'> & { tutorId: string }) {
    const { tutorId, ...rest } = dto;
    return this.tutorCourseService.create(tutorId, rest);
  }

  @Get(':tutorId')
  findAll(@Param('tutorId') tutorId: string) {
    return this.tutorCourseService.findAllByTutor(tutorId);
  }

  @Get(':tutorId/:id')
  findOne(@Param('id') id: string, @Param('tutorId') tutorId: string) {
    return this.tutorCourseService.findOne(id, tutorId);
  }

  @Patch(':tutorId/:id')
  update(
    @Param('id') id: string,
    @Param('tutorId') tutorId: string,
    @Body() dto: Partial<TutorCourseAttrs>,
  ) {
    return this.tutorCourseService.update(id, tutorId, dto);
  }

  @Post(':tutorId/:id/submit')
  submitForReview(@Param('id') id: string, @Param('tutorId') tutorId: string) {
    return this.tutorCourseService.submitForReview(id, tutorId);
  }

  @Delete(':tutorId/:id')
  remove(@Param('id') id: string, @Param('tutorId') tutorId: string) {
    return this.tutorCourseService.remove(id, tutorId);
  }
}
