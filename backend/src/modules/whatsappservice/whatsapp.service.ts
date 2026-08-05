import { prisma } from "../../config/prisma";
import axios from "axios";
import crypto from "crypto";

export class WhatsappService {
  /**
   * Generates a 32-byte encryption key from the JWT_ACCESS_SECRET
   */
  private static getEncryptionKey(): Buffer {
    const secret = process.env.JWT_ACCESS_SECRET || "default_secret_key_needs_32bytes_!";
    return crypto.createHash("sha256").update(secret).digest();
  }

  /**
   * Encrypts a string (e.g., Access Token)
   */
  public static encryptText(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.getEncryptionKey(), iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string
   */
  public static decryptText(encryptedData: string): string {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }
    
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  /**
   * Sends a WhatsApp text message using the Meta Graph API.
   * @param to Phone number to send the message to (with country code, no '+')
   * @param message Text message content
   */
  static async sendTextMessage(to: string, message: string): Promise<any> {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error("No company found.");
    }

    const config = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error("WhatsApp configuration is missing or incomplete.");
    }

    const accessToken = this.decryptText(config.accessToken);

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: {
        preview_url: false,
        body: message,
      },
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error sending WhatsApp message:", error?.response?.data || error.message);
      throw new Error(
        `Failed to send WhatsApp message: ${
          error?.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /**
   * Sends a WhatsApp Template message using the Meta Graph API.
   * This is required to send a message directly without the user sending 'Hi' first.
   */
  static async sendTemplateMessage(to: string, templateName: string = "hello_world", languageCode: string = "en_US"): Promise<any> {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error("No company found.");
    }

    const config = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error("WhatsApp configuration is missing or incomplete.");
    }

    const accessToken = this.decryptText(config.accessToken);

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;

    const data = {
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error sending WhatsApp Template message:", error?.response?.data || error.message);
      throw new Error(
        `Failed to send WhatsApp Template message: ${
          error?.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /**
   * Uploads media (e.g., PDF) to the Meta Graph API and returns the media ID.
   * @param fileBuffer The file content buffer
   * @param filename The name of the file (e.g., Quotation.pdf)
   * @param mimetype The MIME type of the file (e.g., application/pdf)
   */
  static async uploadMedia(fileBuffer: Buffer, filename: string, mimetype: string): Promise<string> {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error("No company found.");
    }

    const config = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error("WhatsApp configuration is missing or incomplete.");
    }

    const accessToken = this.decryptText(config.accessToken);

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/media`;

    const FormData = require("form-data");
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", fileBuffer, {
      filename: filename,
      contentType: mimetype,
    });

    try {
      const response = await axios.post(url, form, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...form.getHeaders(),
        },
      });
      return response.data.id;
    } catch (error: any) {
      console.error("Error uploading media to WhatsApp:", error?.response?.data || error.message);
      throw new Error(
        `Failed to upload media to WhatsApp: ${
          error?.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /**
   * Sends a WhatsApp document message using a previously uploaded media ID.
   * @param to Phone number to send the message to (with country code, no '+')
   * @param mediaId The media ID returned from uploadMedia
   * @param filename Optional filename to display
   * @param caption Optional caption to include with the document
   */
  static async sendDocumentMessage(to: string, mediaId: string, filename?: string, caption?: string): Promise<any> {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error("No company found.");
    }

    const config = await prisma.whatsappConfig.findUnique({
      where: { companyId: company.id },
    });

    if (!config || !config.accessToken || !config.phoneNumberId) {
      throw new Error("WhatsApp configuration is missing or incomplete.");
    }

    const accessToken = this.decryptText(config.accessToken);

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "document",
      document: {
        id: mediaId,
        ...(caption && { caption }),
        ...(filename && { filename }),
      },
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error: any) {
      console.error("Error sending WhatsApp document message:", error?.response?.data || error.message);
      throw new Error(
        `Failed to send WhatsApp document message: ${
          error?.response?.data?.error?.message || error.message
        }`
      );
    }
  }
}
