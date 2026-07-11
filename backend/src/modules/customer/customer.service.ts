import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";

import {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customer.validation";

class CustomerService {
  async createCustomer(data: CreateCustomerInput, currentUser: { userId: string; companyId: string }) {
    console.log(currentUser, 'lkjlk')
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        companyId: currentUser.companyId,
        customerCode: data.customerCode,
      },
    });

    if (existingCustomer) {
      throw new Error("Customer code already exists for this company");
    }

    return prisma.customer.create({
      data: {
        ...data,
        customerType: data.customerType.join(","),
        companyId: currentUser.companyId,
        createdBy: currentUser.userId,
      },
    });
  }

  async getAllCustomers(search?: string) {
    const whereClause = search
      ? {
        OR: [
          { customerCode: { contains: search, mode: "insensitive" as const } },
          { firmName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { mobile: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {};

    return prisma.customer.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getNextCustomerCode() {
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: {
        customerCode: "desc",
      },
    });

    if (!lastCustomer) {
      return "CUST001";
    }

    const lastCode = lastCustomer.customerCode;
    const match = lastCode.match(/\d+/);
    if (!match) {
      return lastCode + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastCode.substring(0, lastCode.indexOf(numberStr));
    const suffix = lastCode.substring(lastCode.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }

  async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new ApiError(
        404,
        "Customer not found"
      );
    }

    return customer;
  }

  async updateCustomer(
    id: string,
    data: UpdateCustomerInput
  ) {
    const customer = await this.getCustomerById(id);

    if (data.customerCode) {
      const existingCustomer =
        await prisma.customer.findFirst({
          where: {
            companyId: customer.companyId,

            customerCode:
              data.customerCode,

            id: {
              not: id,
            },
          },
        });

      if (existingCustomer) {
        throw new ApiError(
          409,
          "Customer code already exists for this company"
        );
      }
    }

    return prisma.customer.update({
      where: { id },
      data: {
        ...(data as any),
        ...(data.customerType && {
          customerType: data.customerType.join(","), // only join if it's present in this update
        }),
      }
    });
  }

  async deleteCustomer(id: string) {
    await this.getCustomerById(id);

    // Block delete if sales orders are linked
    const linkedOrders = await prisma.salesOrder.count({
      where: { customerId: id },
    });

    if (linkedOrders > 0) {
      throw new ApiError(
        409,
        `Cannot delete customer — ${linkedOrders} sales order(s) are linked to this customer`
      );
    }

    return executeDeleteWithValidation(
      () => prisma.customer.delete({ where: { id } }),
      "Customer"
    );
  }
}

export default new CustomerService();