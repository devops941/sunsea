import { Request, Response, NextFunction } from "express";
import { accountsService } from "./accounts.service";
import { payableService } from "./payable.service";
import { receivableService } from "./receivable.service";
import { periodService } from "./period.service";
import { createLedgerSchema, updateLedgerSchema, getLedgersQuerySchema, ledgerStatementQuerySchema } from "./accounts.types";

export class AccountsController {
  async getLedgers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getLedgersQuerySchema.parse(req.query);
      const result = await accountsService.getLedgers(query);
      res.json({
        success: true,
        data: result.ledgers,
        pagination: {
          totalItems: result.total,
          currentPage: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLedgerById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const ledger = await accountsService.getLedgerById(id);
      res.json({
        success: true,
        data: ledger,
      });
    } catch (error) {
      next(error);
    }
  }

  async createLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createLedgerSchema.parse(req.body);
      const ledger = await accountsService.createLedger(data);
      res.status(201).json({
        success: true,
        data: ledger,
        message: "Account ledger created successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async updateLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const data = updateLedgerSchema.parse(req.body);
      const ledger = await accountsService.updateLedger(id, data);
      res.json({
        success: true,
        data: ledger,
        message: "Account ledger updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getLedgerStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const query = ledgerStatementQuerySchema.parse(req.query);
      const statement = await accountsService.getLedgerStatement(id, query);
      res.json({
        success: true,
        data: statement,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayableSummaries(req: Request, res: Response, next: NextFunction) {
    try {
      const { asOnDate, startDate, endDate, supplierId, search, page, limit } = req.query;
      const result = await payableService.getPayableSummaries({
        asOnDate: asOnDate as string,
        startDate: startDate as string,
        endDate: endDate as string,
        supplierId: supplierId ? String(supplierId) : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSupplierPayableDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = parseInt(req.params.supplierId as string, 10);
      const { startDate, endDate } = req.query;
      const data = await payableService.getSupplierPayableDetail(supplierId, {
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReceivableSummaries(req: Request, res: Response, next: NextFunction) {
    try {
      const { asOnDate, startDate, endDate, customerId, search } = req.query;
      const data = await receivableService.getReceivableSummaries({
        asOnDate: asOnDate as string,
        startDate: startDate as string,
        endDate: endDate as string,
        customerId: customerId ? String(customerId) : undefined,
        search: search as string,
      });
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerReceivableDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.params.customerId as string;
      const { startDate, endDate } = req.query;
      const data = await receivableService.getCustomerReceivableDetail(customerId, {
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await accountsService.getTrialBalance();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getProfitAndLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const data = await accountsService.getProfitAndLoss({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await periodService.listPeriods(companyId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodName, startDate, endDate, companyId } = req.body;
      const data = await periodService.createPeriod({ periodName, startDate, endDate, companyId });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async closePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const closedBy = (req as any).user?.userId;
      const data = await periodService.closePeriod(id, closedBy);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async reopenPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const data = await periodService.reopenPeriod(id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const accountsController = new AccountsController();

