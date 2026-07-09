import type { PurchaseOrderFormData } from "../../../../features/purchaseOrder/types";


export const validatePurchaseOrder = (data: PurchaseOrderFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  // PO Date
  if (!data.poDate) {
    errors.poDate = "PO Date is required";
  }

  // Expected Delivery Date
  if (!data.expectedDeliveryDate) {
    errors.expectedDeliveryDate = "Expected Delivery Date is required";
  } else if (data.poDate && data.expectedDeliveryDate < data.poDate) {
    errors.expectedDeliveryDate = "Expected delivery date must be after PO date";
  }

  // Supplier
  if (!data.supplierId) {
    errors.supplierId = "Supplier is required";
  }

  // Billing Address
  if (!data.billingAddressLine1) {
    errors.billingAddressLine1 = "Billing address line is required";
  }
  if (!data.billingCity) {
    errors.billingCity = "Billing city is required";
  }
  if (!data.billingState) {
    errors.billingState = "Billing state is required";
  }
  if (!data.billingPincode) {
    errors.billingPincode = "Billing pincode is required";
  } else if (!/^\d{6}$/.test(data.billingPincode)) {
    errors.billingPincode = "Invalid pincode format";
  }

  // Shipping Address (only if not same as billing)


  // Items
  if (data.items.length === 0) {
    errors.items = "At least one item is required";
  }

  data.items.forEach((item, index) => {
    if (!item.productId) {
      errors[`items.${index}.productId`] = "Product is required";
    }
    if (!item.uom)
      errors[`items.${index}.uom`] = "UOM is required";
    if (!item.quantity || item.quantity <= 0) {
      errors[`items.${index}.quantity`] = "Quantity must be greater than 0";
    }
    if (item.unitPrice < 0) {
      errors[`items.${index}.unitPrice`] = "Unit price cannot be negative";
    }
    if (item.discount < 0 || item.discount > 100) {
      errors[`items.${index}.discount`] = "Discount must be between 0 and 100";
    }
    if (item.tax < 0 || item.tax > 100) {
      errors[`items.${index}.tax`] = "Tax must be between 0 and 100";
    }
  });

  return errors;
};