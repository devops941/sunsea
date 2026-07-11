import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import apiRoutes from "./routes/index.routes";

import { errorMiddleware } from "./middleware/error.middleware";
import { isProduction } from "./config/env";

const app: Application = express();

/** Trust reverse proxy in production*/
if (isProduction) {
  app.set("trust proxy", 1);
}

/** CORS Configuration*/
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
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
/** Application Routes*/
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
