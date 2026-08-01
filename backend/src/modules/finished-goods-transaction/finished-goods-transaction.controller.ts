import { Request, Response } from "express";
import finishedGoodsTransactionService from "./finished-goods-transaction.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class FinishedGoodsTransactionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const txn = await finishedGoodsTransactionService.create(req.body, userId);

    const safeTxn = JSON.parse(JSON.stringify(txn, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("finishedGoodsTransaction:created", safeTxn);

    return res.status(201).json(
      new ApiResponse("Finished Goods Transaction created successfully", txn)
    );
  });

  findAll = asyncHandler(async (_req: Request, res: Response) => {
    const txns = await finishedGoodsTransactionService.findAll();

    return res.status(200).json(
      new ApiResponse("Finished Goods Transactions fetched successfully", txns)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { fgTxnId } = req.params;
    const txn = await finishedGoodsTransactionService.findById(BigInt(String(fgTxnId)));

    return res.status(200).json(
      new ApiResponse("Finished Goods Transaction fetched successfully", txn)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { fgTxnId } = req.params;
    const txn = await finishedGoodsTransactionService.update(
      BigInt(String(fgTxnId)),
      req.body
    );

    const safeTxn = JSON.parse(JSON.stringify(txn, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("finishedGoodsTransaction:updated", safeTxn);

    return res.status(200).json(
      new ApiResponse("Finished Goods Transaction updated successfully", txn)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { fgTxnId } = req.params;
    await finishedGoodsTransactionService.delete(BigInt(String(fgTxnId)));

    getIO().emit("finishedGoodsTransaction:deleted", { id: String(fgTxnId) });

    return res.status(200).json(
      new ApiResponse("Finished Goods Transaction deleted successfully")
    );
  });
}

export default new FinishedGoodsTransactionController();
