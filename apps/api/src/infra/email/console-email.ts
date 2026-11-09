import type { EmailPort } from '../../ports/iam.js';

/**
 * Local trial and development (design.md 5.1): the reset link is printed to the API log instead of
 * being sent. The provider adapter replaces it once Q-03 names the email account (DEC-102).
 */
export class ConsoleEmailAdapter implements EmailPort {
  constructor(
    private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {}

  sendPasswordReset({ to, link }: { to: string; name: string; link: string }): Promise<void> {
    this.write(`[email] Password reset for ${to}: ${link}`);
    return Promise.resolve();
  }
}
