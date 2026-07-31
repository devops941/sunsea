import nodemailer from "nodemailer";
import { prisma } from "../config/prisma";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: nodemailer.SendMailOptions["attachments"];
}

export const sendEmail = async (options: SendEmailOptions) => {
  let smtpHost = process.env.SMTP_HOST || "";
  let smtpPort = Number(process.env.SMTP_PORT) || 587;
  let smtpUser = process.env.SMTP_USER || "";
  let smtpPass = process.env.SMTP_PASS || "";
  let fromEmail = process.env.SMTP_FROM || "";
  let fromName = process.env.FROM_NAME || "Sunsea";
  let encryption = process.env.SMTP_ENCRYPTION || "TLS";

  try {
    const config = await prisma.emailConfig.findFirst();

    if (config) {
      smtpHost = config.smtpHost || smtpHost;
      smtpPort = config.smtpPort || smtpPort;
      smtpUser = config.smtpUsername || smtpUser;
      smtpPass = config.smtpPassword || smtpPass;
      fromEmail = config.fromEmail || fromEmail;
      fromName = config.fromName || fromName;
      encryption = config.encryption || encryption;
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP configuration is incomplete. Please check database or .env file.");
    }

    // Railway blocks port 587 — force port 465 (SSL) for production compatibility
    const effectivePort = smtpPort === 587 ? 465 : smtpPort;
    const isSSL = effectivePort === 465 || encryption === "SSL";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: effectivePort,
      secure: isSSL,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    } as any);

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
