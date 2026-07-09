import { Request, Response } from "express";

import productImageService from "./product-image.service";

const serializeBigInt = (
  data: any
) =>
  JSON.parse(
    JSON.stringify(
      data,
      (_, value) =>
        typeof value === "bigint"
          ? value.toString()
          : value
    )
  );

class ProductImageController {
  async create(
    req: Request,
    res: Response
  ) {
    const result =
      await productImageService.create(
        req.body
      );

    return res.status(201).json({
      success: true,
      data: serializeBigInt(result),
    });
  }

  async findAll(
    req: Request,
    res: Response
  ) {
    const result =
      await productImageService.findAll();

    return res.status(200).json({
      success: true,
      data: serializeBigInt(result),
    });
  }

  async findById(
    req: Request,
    res: Response
  ) {
    const result =
      await productImageService.findById(
        BigInt(
          String(req.params.id)
        )
      );

    return res.status(200).json({
      success: true,
      data: serializeBigInt(result),
    });
  }

  async update(
    req: Request,
    res: Response
  ) {
    const result =
      await productImageService.update(
        BigInt(
          String(req.params.id)
        ),
        req.body
      );

    return res.status(200).json({
      success: true,
      data: serializeBigInt(result),
    });
  }

  async delete(
    req: Request,
    res: Response
  ) {
    await productImageService.delete(
      BigInt(
        String(req.params.id)
      )
    );

    return res.status(200).json({
      success: true,
      message:
        "Product Image deleted successfully",
    });
  }
}

export default new ProductImageController();