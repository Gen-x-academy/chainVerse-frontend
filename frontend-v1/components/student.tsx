import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// Token expiry constants (in seconds)
const VERIFICATION_TOKEN_EXPIRY = 86400; // 24 hours
const RESET_TOKEN_EXPIRY = 900;          // 15 minutes

export interface Student {
  id: string;
  email: string;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
  isVerified: boolean;
}

export interface StudentRepository {
  findById(id: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;
  update(id: string, data: Partial<Student>): Promise<Student>;
}

export interface MailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

export class StudentAuthService {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly mailService: MailService,
    private readonly jwtSecret: string,
  ) {}

  /**
   * Creates a fresh verification token for a student and persists it.
   */
  async createVerificationToken(studentId: string): Promise<string> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    const token = jwt.sign(
      { sub: student.id, type: 'email_verification' },
      this.jwtSecret,
      { expiresIn: VERIFICATION_TOKEN_EXPIRY },
    );

    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY * 1000);

    await this.studentRepo.update(student.id, {
      verificationToken: token,
      verificationTokenExpiresAt: expiresAt,
    });

    return token;
  }

  /**
   * Generates a new verification email if the existing token is missing or expired.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const student = await this.studentRepo.findByEmail(email);
    if (!student) {
      throw new Error('Student not found');
    }

    if (student.isVerified) {
      throw new Error('Email is already verified');
    }

    const isExpired =
      !student.verificationTokenExpiresAt ||
      student.verificationTokenExpiresAt.getTime() < Date.now();

    let token = student.verificationToken;

    if (!token || isExpired) {
      token = jwt.sign(
        { sub: student.id, type: 'email_verification' },
        this.jwtSecret,
        { expiresIn: VERIFICATION_TOKEN_EXPIRY },
      );

      const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY * 1000);

      await this.studentRepo.update(student.id, {
        verificationToken: token,
        verificationTokenExpiresAt: expiresAt,
      });
    }

    await this.mailService.sendVerificationEmail(student.email, token);
  }

  /**
   * Creates a short-lived password reset token.
   */
  async createPasswordResetToken(email: string): Promise<string> {
    const student = await this.studentRepo.findByEmail(email);
    if (!student) {
      throw new Error('Student not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY * 1000);

    await this.studentRepo.update(student.id, {
      resetToken: token,
      resetTokenExpiresAt: expiresAt,
    });

    await this.mailService.sendPasswordResetEmail(student.email, token);

    return token;
  }
}
