/** MENTOR-024: mentor profile detail view model with public/private field separation. */
export interface MentorProfileRecord {
  id: string;
  displayName: string;
  headline: string;
  bio: string;
  skills: string[];
  languages: string[];
  timeZone: string;
  yearsExperience: number;
  rating?: number;
  reviewCount: number;
  acceptingMentees: boolean;
  verified: boolean;
  /** Never shown to other users. */
  email?: string;
  walletAddress?: string;
  internalNotes?: string;
}

export interface MentorProfileView {
  id: string;
  displayName: string;
  headline: string;
  bio: string;
  skills: string[];
  languages: string[];
  timeZone: string;
  experienceLabel: string;
  ratingLabel: string;
  availabilityLabel: string;
  verified: boolean;
}

export function experienceLabel(years: number): string {
  if (years <= 0) return 'New mentor';
  return years === 1 ? '1 year of experience' : `${years} years of experience`;
}

export function ratingLabel(rating: number | undefined, count: number): string {
  if (!rating || count === 0) return 'No reviews yet';
  return `${rating.toFixed(1)} (${count} review${count === 1 ? '' : 's'})`;
}

/** Whitelist projection: only listed fields can reach the page, so new private fields stay private. */
export function toProfileView(p: MentorProfileRecord): MentorProfileView {
  return {
    id: p.id,
    displayName: p.displayName,
    headline: p.headline,
    bio: p.bio,
    skills: [...p.skills],
    languages: [...p.languages],
    timeZone: p.timeZone,
    experienceLabel: experienceLabel(p.yearsExperience),
    ratingLabel: ratingLabel(p.rating, p.reviewCount),
    availabilityLabel: p.acceptingMentees ? 'Accepting new mentees' : 'Not accepting mentees right now',
    verified: p.verified,
  };
}
