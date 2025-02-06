import { SendMailOptions, createTransport } from "nodemailer";
import { MAILER_CONFIG } from "../config";
import { logger } from "../utils";
import { changeEmailAddress } from "../templates";
import { forgotPassword } from "../templates";

const transporter = createTransport({
  service: MAILER_CONFIG.service,
  host: "mail.esparkconsultants.com",
  port: 465, // Typically 465 for SSL/TLS
  secure: true, // true for SSL
  auth: {
    user: MAILER_CONFIG.from,
    pass: MAILER_CONFIG.pass,
  },
});

class MailService {
  private sendMail(mailDetails: SendMailOptions) {
    try {
      return transporter.sendMail(mailDetails);
    } catch (err) {
      logger.error(err);
    }
  }

  changeEmailAddress(userData: any) {
    const template = changeEmailAddress({
      name: userData?.name,
      oldEmail: userData?.oldEmail,
      newEmail: userData?.newEmail,
      link: userData?.link,
    });

    const mailDetails: SendMailOptions = {
      from: MAILER_CONFIG.from,
      to: userData?.newEmail,
      subject: "Confirm Email Change",
      html: template,
    };
    return this.sendMail(mailDetails);
  }

  forgotPassword(userData: any) {
    const template = forgotPassword({
      name: userData?.name,
      email: userData?.email,
      link: userData?.link,
    });

    const mailDetails: SendMailOptions = {
      from: MAILER_CONFIG.from,
      to: userData?.email,
      subject: "Reset Password",
      html: template,
    };
    return this.sendMail(mailDetails);
  }
}

export const mailService = new MailService();
