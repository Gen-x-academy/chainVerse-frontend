import React from 'react';
import { useRouter } from 'next/router';

const CourseDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;

  // Fetch course details using id here

  return (
    <div>
      <h1>Course Detail Page</h1>
      <p>Course ID: {id}</p>
      {/* Render course details here */}
    </div>
  );
};

export default CourseDetailPage;
