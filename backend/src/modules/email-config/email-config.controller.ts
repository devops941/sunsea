import { Request, Response } from "express";

import { ApiError } from "../../utils/ApiError";
import { prisma } from "../../config/prisma";
import { sendEmail } from "../../utils/mailer";
import { logAudit } from "../../utils/auditLog.util";

export const getEmailConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.emailConfig.findFirst();

    res.status(200).json({
      success: true,
      data: config || null,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      console.error("Error in getEmailConfig:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
};

export const saveEmailConfig = async (req: Request, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUsername, smtpPassword, fromEmail, fromName, encryption } = req.body;

    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !fromEmail || !fromName) {
      throw new ApiError(400, "All SMTP fields are required");
    }

    let config = await prisma.emailConfig.findFirst();

    if (config) {
      config = await prisma.emailConfig.update({
        where: { id: config.id },
        data: {
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUsername,
          smtpPassword,
          fromEmail,
          fromName,
          encryption: encryption || "TLS",
        },
      });
    } else {
      config = await prisma.emailConfig.create({
        data: {
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUsername,
          smtpPassword,
          fromEmail,
          fromName,
          encryption: encryption || "TLS",
        },
      });
    }

    const userId = (req as any).user?.userId || ((req as any).user?.id ? `admin_${(req as any).user.id}` : ((req as any).admin?.id ? `admin_${(req as any).admin.id}` : undefined));
    await logAudit("EmailConfig", config.id, "UPDATE", userId, "System Email Config");

    res.status(200).json({
      success: true,
      message: "Email configuration saved successfully",
      data: config,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      console.error("Error in saveEmailConfig:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
};


export const sendEmailDirect = async (req: Request, res: Response) => {
  try {
    const { recipientEmail, subject, message } = req.body;

    if (!recipientEmail || !subject || !message) {
      throw new ApiError(400, "Recipient email, subject, and message are required.");
    }

    const info = await sendEmail({
      to: recipientEmail,
      subject: subject,
      text: message,
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      data: info,
    });
  } catch (error: any) {
    console.error("Error in sendEmailDirect:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send email. Please check your configuration.",
    });
  }
};

export const sendEmailWithAttachment = async (req: Request, res: Response) => {
  try {
    const { recipientEmail, subject, message } = req.body;
    const file = req.file;

    if (!recipientEmail || !subject || !message) {
      throw new ApiError(400, "Recipient email, subject, and message are required.");
    }

    if (!file) {
      throw new ApiError(400, "Attachment file is required.");
    }

    const attachments = [
      {
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      }
    ];

    const info = await sendEmail({
      to: recipientEmail,
      subject: subject,
      text: message,
      attachments,
    });

    res.status(200).json({
      success: true,
      message: "Email with attachment sent successfully",
      data: info,
    });
  } catch (error: any) {
    console.error("Error in sendEmailWithAttachment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send email. Please check your configuration.",
    });
  }
};
