import { Router } from "express";
import { pettyCashController } from "./petty-cash.controller";

const router = Router();

router.get("/", (req, res, next) => pettyCashController.getEntries(req, res, next));
router.post("/", (req, res, next) => pettyCashController.createEntry(req, res, next));

export default router;
