import { Prisma } from '@prisma/client';
import { ApiError } from './ApiError';

/**
 * A reusable utility to gracefully handle Prisma deletion errors, particularly foreign key constraints.
 * 
 * @param deleteOperation The Prisma delete function to execute
 * @param resourceName The name of the resource (e.g. "Machine", "Employee") for user-friendly error messages
 * @returns The result of the delete operation if successful
 * @throws ApiError with 409 if referenced, 404 if not found
 */
export const executeDeleteWithValidation = async <T>(
    deleteOperation: () => Promise<T>,
    resourceName: string = "Record"
): Promise<T> => {
    try {
        return await deleteOperation();
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2003: Foreign key constraint failed
            if (error.code === 'P2003') {
                throw new ApiError(
                    409, 
                    `Cannot delete this ${resourceName} because it is currently in use or referenced by other records.`
                );
            }
            // P2025: Record to delete does not exist
            if (error.code === 'P2025') {
                throw new ApiError(404, `${resourceName} not found.`);
            }
        }
        // Re-throw if it's not a handled Prisma error
        throw error;
    }
};
