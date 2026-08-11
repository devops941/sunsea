import { env } from "../config/env";

export interface WelcomeEmailData {
  fullName: string;
  empCode?: string | null;
  username: string;
  password?: string | null;
  portalUrl?: string;
  title?: string;
  subtitle?: string;
  teamName?: string;
}

/**
 * Generates a grand, modern, big-brand styled HTML Email Template for Sunsea portal welcome & credential emails.
 */
export const generateWelcomeEmailHtml = (data: WelcomeEmailData): string => {
  const portalUrl = data.portalUrl || process.env.FRONTEND_URL || env.FRONTEND_URL || "http://localhost:5173";
  const fullName = data.fullName || "Team Member";
  const empCode = data.empCode;
  const username = data.username;
  const password = data.password;
  const title = data.title || "Welcome to Sunsea!";
  const subtitle = data.subtitle || "Your official employee account and login credentials are ready.";
  const teamName = data.teamName || "Sunsea HR & IT Team";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Outer Wrapper -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Top Accent Rainbow Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #2563eb 0%, #4f46e5 40%, #06b6d4 75%, #10b981 100%);"></td>
          </tr>

          <!-- Header Section with Logo -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; background-color: #ffffff; text-align: left; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- Sunsea Brand Icon + Title -->
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #2563eb, #1d4ed8); width: 44px; height: 44px; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">
                          <span style="color: #ffffff; font-size: 22px; font-weight: bold; line-height: 44px;">☀️</span>
                        </td>
                        <td style="padding-left: 14px;">
                          <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.2;">
                            SUNSEA
                          </div>
                          <div style="font-size: 11px; font-weight: 700; color: #2563eb; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">
                            ENTERPRISE MANAGEMENT PORTAL
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Body Section -->
          <tr>
            <td style="padding: 36px 40px 32px 40px; background-color: #ffffff;">
              <!-- Welcome Title -->
              <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.3;">
                ${title} <span style="font-size: 24px;">🎉</span>
              </h1>
              
              <!-- Subtitle Badge -->
              <div style="display: inline-block; background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 20px; margin-bottom: 24px;">
                ${subtitle}
              </div>

              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Dear <strong style="color: #0f172a; font-weight: 700;">${fullName}</strong>,
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                Your account and login credentials have been created successfully. You can now log in to access your employee dashboard, workflow features, and team workspace.
              </p>

              <!-- Credentials Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 12px; margin-bottom: 28px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                      🔑 YOUR LOGIN CREDENTIALS
                    </div>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${empCode ? `
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: 600; width: 140px; vertical-align: middle;">
                          Employee Code:
                        </td>
                        <td style="padding: 8px 0; vertical-align: middle;">
                          <span style="background-color: #e0e7ff; color: #3730a3; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid #c7d2fe; display: inline-block;">
                            ${empCode}
                          </span>
                        </td>
                      </tr>
                      ` : ''}

                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: 600; width: 140px; vertical-align: middle;">
                          Username:
                        </td>
                        <td style="padding: 8px 0; vertical-align: middle;">
                          <span style="background-color: #ffffff; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block;">
                            ${username}
                          </span>
                        </td>
                      </tr>

                      ${password ? `
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #64748b; font-weight: 600; width: 140px; vertical-align: middle;">
                          Password:
                        </td>
                        <td style="padding: 8px 0; vertical-align: middle;">
                          <span style="background-color: #fef3c7; color: #92400e; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; font-weight: 800; padding: 4px 12px; border-radius: 6px; border: 1px solid #fde68a; display: inline-block; letter-spacing: 0.5px;">
                            ${password}
                          </span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Warning Callout -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 16px; text-align: left;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 12px; font-size: 20px;">🛡️</td>
                        <td style="vertical-align: middle; font-size: 13px; color: #92400e; line-height: 1.5;">
                          <strong style="color: #78350f;">Security Notice:</strong> For security reasons, please log in to the Sunsea portal and change your password at your earliest convenience.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4); text-align: center;">
                      Log In to Sunsea Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Regards Block -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 14px; color: #64748b; line-height: 1.6;">
                Regards,<br/>
                <strong style="color: #0f172a; font-size: 15px;">${teamName}</strong>
              </div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600;">
                Sunsea Enterprise Management Systems
              </p>
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This is an automated system notification. If you did not request or expect this email, please contact your system administrator.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                &copy; ${new Date().getFullYear()} Sunsea. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
