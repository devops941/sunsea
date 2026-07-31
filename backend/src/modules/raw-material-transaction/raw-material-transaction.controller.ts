import { Request, Response } from "express";
import rawMaterialTransactionService from "./raw-material-transaction.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class RawMaterialTransactionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const txn = await rawMaterialTransactionService.create(req.body);

    const safeTxn = JSON.parse(JSON.stringify(txn, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("rawMaterialTransaction:created", safeTxn);

    return res.status(201).json(
      new ApiResponse("Raw Material Transaction created successfully", txn)
    );
  });

  findAll = asyncHandler(async (_req: Request, res: Response) => {
    const txns = await rawMaterialTransactionService.findAll();

    return res.status(200).json(
      new ApiResponse("Raw Material Transactions fetched successfully", txns)
    );
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const { rmTxnId } = req.params;
    const txn = await rawMaterialTransactionService.findById(BigInt(String(rmTxnId)));

    return res.status(200).json(
      new ApiResponse("Raw Material Transaction fetched successfully", txn)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { rmTxnId } = req.params;
    const txn = await rawMaterialTransactionService.update(BigInt(String(rmTxnId)), req.body);

    const safeTxn = JSON.parse(JSON.stringify(txn, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    getIO().emit("rawMaterialTransaction:updated", safeTxn);

    return res.status(200).json(
      new ApiResponse("Raw Material Transaction updated successfully", txn)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { rmTxnId } = req.params;
    await rawMaterialTransactionService.delete(BigInt(String(rmTxnId)));

    getIO().emit("rawMaterialTransaction:deleted", { id: String(rmTxnId) });

    return res.status(200).json(
      new ApiResponse("Raw Material Transaction deleted successfully")
    );
  });
}

export default new RawMaterialTransactionController();
