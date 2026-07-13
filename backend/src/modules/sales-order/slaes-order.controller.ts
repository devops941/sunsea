import { Request, Response } from "express";
import salesOrderService from "./sales-order.service";
import creditCheckService from "./creditCheckService";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    SalesOrderQueryInput,
    MdApprovalDecisionInput,
    CustomerApprovalDecisionInput,
    UpdateSalesOrderDiscountsInput,
    ApprovalStatusEnum,
    SalesOrderStatusEnum,
    SalesOrderStatus
} from "./sales-order.validation";

class SalesOrderController {

    create = asyncHandler(async (req: Request, res: Response) => {
        const order = await salesOrderService.create(req.body);
        return res.status(201).json(
            new ApiResponse("Sales Order created successfully", order)
        );
    });

    checkCreditBlock = asyncHandler(async (req: Request, res: Response) => {
        const customerId = req.query.customerId as string;
        if (!customerId) {
            return res.status(400).json(new ApiResponse("customerId is required", { blocked: false }));
        }

        const blockResult = await creditCheckService.hasBlockingPendingOrder(customerId);
        return res.status(200).json(
            new ApiResponse("Credit block check completed successfully", blockResult)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const query: SalesOrderQueryInput = {
            page: req.query.page ? Number(req.query.page) : 1,
            pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
            customerId: req.query.customerId as string,
            orderNo: req.query.orderNo as string,
            status: this.parseSalesOrderStatuses(req.query.status),
            mdApprovalStatus: this.parseApprovalStatus(req.query.mdApprovalStatus),
            customerApprovalStatus: this.parseApprovalStatus(req.query.customerApprovalStatus),
            dispatchType: req.query.dispatchType as SalesOrderQueryInput["dispatchType"],
            search: req.query.search as string,
            fromDate: req.query.fromDate as string,
            toDate: req.query.toDate as string,
            sortBy: this.parseSortBy(req.query.sortBy) ?? "createdAt",
            sortOrder: this.parseSortOrder(req.query.sortOrder) ?? "desc",
        };
        const orders = await salesOrderService.findAll(query);
        return res.status(200).json(
            new ApiResponse("Sales Orders fetched successfully", orders)
        );
    });

    findById = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const order = await salesOrderService.findById(Number(id));
        return res.status(200).json(
            new ApiResponse("Sales Order fetched successfully", order)
        );
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const order = await salesOrderService.update(Number(id), req.body);
        return res.status(200).json(
            new ApiResponse("Sales Order updated successfully", order)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        await salesOrderService.delete(Number(id));
        return res.status(200).json(
            new ApiResponse("Sales Order deleted successfully")
        );
    });

    getNextCode = asyncHandler(async (_req: Request, res: Response) => {
        const nextCode = await salesOrderService.getNextSalesOrderCode();
        return res.status(200).json(
            new ApiResponse(
                "Next sales order code fetched successfully",
                { nextCode }
            )
        );
    });

    updateDiscounts = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const discountData: UpdateSalesOrderDiscountsInput = req.body;
        const order = await salesOrderService.updateDiscounts(Number(id), discountData);
        return res.status(200).json(
            new ApiResponse("Sales Order discounts updated successfully", order)
        );
    });

    submitForMdApproval = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const order = await salesOrderService.submitForMdApproval(Number(id));
        return res.status(200).json(
            new ApiResponse("Sales Order submitted for MD approval", order)
        );
    });

    reopen = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const order = await salesOrderService.reopen(Number(id));
        return res.status(200).json(
            new ApiResponse("Sales Order reopened for editing", order)
        );
    });

    mdApprove = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const approvalData: MdApprovalDecisionInput = req.body;
        const order = await salesOrderService.decideMdApproval(Number(id), approvalData);
        return res.status(200).json(
            new ApiResponse("Sales Order MD approval recorded successfully", order)
        );
    });

    customerApprove = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const approvalData: CustomerApprovalDecisionInput = req.body;
        const order = await salesOrderService.decideCustomerApproval(Number(id), approvalData);
        return res.status(200).json(
            new ApiResponse("Sales Order customer approval recorded successfully", order)
        );
    });

    getStatus = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const status = await salesOrderService.getOrderStatus(Number(id));
        return res.status(200).json(
            new ApiResponse("Order status fetched successfully", status)
        );
    });

    // ─── Private helper methods ──────────────────────────────────────

    private parseApprovalStatus(value: unknown): "APPROVED" | "REJECTED" | "PENDING" | undefined {
        if (!value || typeof value !== 'string') return undefined;
        const status = value.toUpperCase();
        if (status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING') {
            return status as "APPROVED" | "REJECTED" | "PENDING";
        }
        return undefined;
    }

    private parseSalesOrderStatus(value: unknown): string | undefined {
        if (!value || typeof value !== 'string') return undefined;
        const result = SalesOrderStatusEnum.safeParse(value.toUpperCase());
        return result.success ? result.data : undefined;
    }

    private parseSortBy(value: unknown): "orderDate" | "createdAt" | "orderNo" | "expectedCompletionDate" | undefined {
        if (!value || typeof value !== 'string') return undefined;
        const sortBy = value.toLowerCase();
        if (sortBy === 'orderDate' || sortBy === 'createdAt' || sortBy === 'orderNo' || sortBy === 'expectedCompletionDate') {
            return sortBy as "orderDate" | "createdAt" | "orderNo" | "expectedCompletionDate";
        }
        return undefined;
    }

    private parseSortOrder(value: unknown): "asc" | "desc" | undefined {
        if (!value || typeof value !== 'string') return undefined;
        const sortOrder = value.toLowerCase();
        if (sortOrder === 'asc' || sortOrder === 'desc') {
            return sortOrder as "asc" | "desc";
        }
        return undefined;
    }

    private parseSalesOrderStatuses(value: unknown): SalesOrderStatus[] | undefined {
        if (!value || typeof value !== 'string') return undefined;
        const statuses = value.split(',').map(s => s.trim().toUpperCase());
        const validStatuses: SalesOrderStatus[] = [];
        for (const s of statuses) {
            const result = SalesOrderStatusEnum.safeParse(s);
            if (result.success) {
                validStatuses.push(result.data);
            } else {
                console.warn(`Invalid status ignored: ${s}`);
            }
        }
        return validStatuses.length > 0 ? validStatuses : undefined;
    }
}

export default new SalesOrderController();