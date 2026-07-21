import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";

import {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customer.validation";

class CustomerService {
  async createCustomer(data: CreateCustomerInput, currentUser: { userId: string; companyId: string }) {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        companyId: currentUser.companyId,
        customerCode: data.customerCode,
      },
    });

    if (existingCustomer) {
      throw new Error("Customer code already exists for this company");
    }

    const { addresses, ...restData } = data;

    return prisma.customer.create({
      data: {
        ...restData,
        customerType: data.customerType.join(","),
        companyId: currentUser.companyId,
        createdBy: currentUser.userId,
        ...(addresses && addresses.length > 0 && {
          addresses: {
            create: addresses.map((addr, index) => ({
              address: addr,
              is_default: index === 0,
              label: `Address ${index + 1}`,
              state_code: addr.state.toLowerCase(),
            }))
          }
        })
      },
    });
  }

  // BUG-CUST-004 fix: added server-side pagination (page, limit, skip/take)
  async getAllCustomers(params: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 10 } = params;

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

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { addresses: true }
      }),
      prisma.customer.count({ where: whereClause }),
    ]);

    // Fetch creator names from User and Admin tables
    const creatorIds = [...new Set(customers.map(c => c.createdBy).filter(Boolean))];

    // Split IDs into admin IDs and normal user IDs
    const adminIds = creatorIds.filter(id => id.startsWith('admin_')).map(id => BigInt(id.replace('admin_', '')));
    const userIds = creatorIds.filter(id => !id.startsWith('admin_'));

    const [admins, users] = await Promise.all([
      adminIds.length > 0 ? prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, fullName: true, role: { select: { name: true } } } }) : [],
      userIds.length > 0 ? prisma.user.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true, role: { select: { name: true } } } }) : []
    ]);

    const adminMap = new Map(admins.map(a => [`admin_${a.id}`, { name: a.fullName, role: a.role?.name || 'Super Admin' }]));
    const userMap = new Map(users.map(u => [u.userId, { name: u.fullName, role: u.role?.name || 'User' }]));

    const customersWithCreators = customers.map(customer => {
      const creatorInfo = adminMap.get(customer.createdBy) || userMap.get(customer.createdBy) || { name: 'Unknown User', role: 'Unknown Role' };
      return {
        ...customer,
        createdUserName: creatorInfo.name,
        createdUserRole: creatorInfo.role
      };
    });

    return {
      customers: customersWithCreators,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
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
      include: {
        addresses: true,
      }
    });

    if (!customer) {
      throw new ApiError(
        404,
        "Customer not found"
      );
    }

    let createdUserName = 'Unknown User';
    let createdUserRole = 'Unknown Role';
    if (customer.createdBy) {
      if (customer.createdBy.startsWith('admin_')) {
        const adminId = BigInt(customer.createdBy.replace('admin_', ''));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, role: { select: { name: true } } } });
        if (admin) {
          createdUserName = admin.fullName;
          createdUserRole = admin.role?.name || 'Super Admin';
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: customer.createdBy }, select: { fullName: true, role: { select: { name: true } } } });
        if (user) {
          createdUserName = user.fullName;
          createdUserRole = user.role?.name || 'User';
        }
      }
    }

    return {
      ...customer,
      createdUserName,
      createdUserRole
    };
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

    const { addresses, ...restData } = data as any;

    return prisma.customer.update({
      where: { id },
      data: {
        ...restData,
        ...(data.customerType && {
          customerType: data.customerType.join(","),
        }),
        ...(addresses && {
          addresses: {
            deleteMany: {},
            create: addresses.map((addr: any, index: number) => ({
              address: addr,
              is_default: index === 0,
              label: `Address ${index + 1}`,
              state_code: addr.state.toLowerCase(),
            }))
          }
        })
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