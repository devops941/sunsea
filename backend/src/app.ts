import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import apiRoutes from "./routes/index.routes";

import { errorMiddleware } from "./middleware/error.middleware";
import { env, isProduction } from "./config/env";

const app: Application = express();

/** Trust reverse proxy in production*/
if (isProduction) {
  app.set("trust proxy", 1);
}

/** CORS Configuration*/
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Build CORS origin list from environment variables
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

// Add production frontend URLs if different from defaults
if (isProduction && env.FRONTEND_URL !== "http://localhost:5173") {
  allowedOrigins.push(env.FRONTEND_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
      "Bypass-Tunnel-Reminder",
    ],
  })
);

/* Security Headers*/
app.use((_req, res, next) => {
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  res.setHeader(
    "X-XSS-Protection",
    "1; mode=block"
  );

  if (isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
});

/** Request Parsers*/
app.use(cookieParser());

app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
/** Request Logger Middleware */
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

/** Application Routes*/
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Sunsea ERP API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/debug/smtp-test", async (req, res) => {
  const nodemailer = require("nodemailer");
  const results: any[] = [];

  const test = async (port: number, secure: boolean) => {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });

    try {
      await transporter.verify();
      results.push({ port, secure, status: "SUCCESS" });
    } catch (e: any) {
      results.push({
        port,
        secure,
        status: "FAILED",
        code: e.code,
        message: e.message,
      });
    }
  };

  await test(587, false);
  await test(465, true);

  res.json({ results });
});
app.use("/api", apiRoutes);

/** Route Not Found Handler*/
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/** Global Error Handler*/
app.use(errorMiddleware);

export default app;
