import { SendMailOptions, createTransport } from "nodemailer";
import { MAILER_CONFIG } from "../config";
import { logger } from "../utils";
import { changeEmailAddress, registerNewDevice } from "../templates";
import { forgotPassword, verifyEmail } from "../templates";

const transporter = createTransport({
  service: MAILER_CONFIG.service,
  host: MAILER_CONFIG.host,
  port: MAILER_CONFIG.port, // Typically 465 for SSL/TLS
  secure: MAILER_CONFIG.secure, // true for SSL
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

  registerNewDevice(userData: any) {
    const template = registerNewDevice({
      name: userData?.name,
      email: userData?.email,
      link: userData?.link,
    });

    const mailDetails: SendMailOptions = {
      from: MAILER_CONFIG.from,
      to: userData?.email,
      subject: "Register New Device For 2FA",
      html: template,
    };
    return this.sendMail(mailDetails);
  }
  verifyEmail(userData: any) {
    const template = verifyEmail({
      name: userData?.name,
      email: userData?.email,
      link: userData?.link,
    });

    const mailDetails: SendMailOptions = {
      from: MAILER_CONFIG.from,
      to: userData?.email,
      subject: "Verify Email",
      html: template,
    };
    return this.sendMail(mailDetails);
  }
}

export const mailService = new MailService();
