import React, { useEffect, useState } from "react";
import type { Customer } from "../../../features/customer/types";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { customerService } from "../../../services/customerService";

interface CustomerViewModalProps {
    show: boolean;
    onHide: () => void;
    customer: Customer | null;
}

const getGradeName = (customer: any) => {
    if (!customer) return "N/A";
    const grade = customer.customerGrade || customer.grade;
    if (grade) {
        if (typeof grade === "object") return grade.name || grade.customerGradeName || grade.gradeName || "N/A";
        if (typeof grade === "string" && grade.trim() !== "") return grade;
    }
    if (customer.customerGradeName) return customer.customerGradeName;
    return "N/A";
};

const getTypeName = (customer: any) => {
    if (!customer) return "N/A";
    const type = customer.customerType || customer.type;
    if (type) {
        if (typeof type === "object") return type.name || type.customerTypeName || type.typeName || "N/A";
        if (typeof type === "string" && type.trim() !== "") return type;
    }
    if (customer.customerTypeName) return customer.customerTypeName;
    return "N/A";
};

const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
    show,
    onHide,
    customer: initialCustomer,
}) => {
    const [fullCustomer, setFullCustomer] = useState<any>(initialCustomer);

    useEffect(() => {
        setFullCustomer(initialCustomer);
        if (show && initialCustomer?.id) {
            customerService.fetchById(String(initialCustomer.id))
                .then(data => {
                    if (data) setFullCustomer(data);
                })
                .catch(() => {});
        }
    }, [show, initialCustomer]);

    const customer = fullCustomer || initialCustomer;
    if (!customer) return null;

    const getBillingAddress = () => {
        // 1. Direct billing fields on customer
        if (customer.billingAddressLine1 || customer.billingCity || customer.billingState || customer.billingPincode) {
            return {
                line1: customer.billingAddressLine1 || "",
                line2: (customer as any).billingAddressLine2 || "",
                city: customer.billingCity || "",
                state: customer.billingState || "",
                pincode: customer.billingPincode || "",
                country: customer.billingCountry || "India",
            };
        }

        // 2. Check customer.addresses array
        if (Array.isArray(customer.addresses) && customer.addresses.length > 0) {
            const addrItem: any = customer.addresses[0];
            let addrObj = addrItem.address;
            if (typeof addrObj === "string") {
                try {
                    addrObj = JSON.parse(addrObj);
                } catch {
                    addrObj = {};
                }
            }
            if (!addrObj || typeof addrObj !== "object") {
                addrObj = addrItem;
            }

            const line1 = addrObj.addressLine1 || addrObj.line1 || addrItem.addressLine1 || "";
            const line2 = addrObj.addressLine2 || addrObj.line2 || addrItem.addressLine2 || "";
            const city = addrObj.city || addrItem.city || "";
            const state = addrObj.state || addrItem.state || "";
            const pincode = addrObj.pincode || addrItem.pincode || "";
            const country = addrObj.country || addrItem.country || "India";

            if (line1 || city || state || pincode) {
                return { line1, line2, city, state, pincode, country };
            }
        }

        // 3. Fallback to shipping fields if saved there
        if (customer.shippingAddressLine1) {
            return {
                line1: customer.shippingAddressLine1,
                line2: (customer as any).shippingAddressLine2 || "",
                city: customer.shippingCity || "",
                state: customer.shippingState || "",
                pincode: customer.shippingPincode || "",
                country: (customer as any).shippingCountry || "India",
            };
        }

        return null;
    };

    const billingAddr = getBillingAddress();

    return (
        <CommonViewModal
            show={show}
            onHide={onHide}
            modalTitle="Customer Details"
            avatarText={customer.displayName?.charAt(0).toUpperCase() || customer.firmName?.charAt(0).toUpperCase() || "C"}
            headerTitle={customer.displayName || customer.firmName || "N/A"}
            headerSubtitle={`${customer.customerCode || "N/A"}`}
            statusNode={
                <StatusBadge status={customer.status === "Active" ? "ACTIVE" : "INACTIVE"} />
            }
            sections={[
                {
                    title: "Basic & Classification Details",
                    fields: [
                        { label: "Customer Code", value: customer.customerCode || "N/A" },
                        { label: "Firm Name", value: customer.firmName || "N/A" },
                        { label: "Display Name", value: customer.displayName || "N/A" },
                        { label: "Customer Grade", value: getGradeName(customer) },
                        { label: "Customer Type", value: getTypeName(customer) },
                    ]
                },
                {
                    title: "Contact & Tax Details",
                    fields: [
                        ...(Array.isArray(customer.mobile) && customer.mobile.length > 0
                            ? customer.mobile.map((p: any) => ({ label: p.label || "Mobile", value: p.number }))
                            : (customer as any).phones && Array.isArray((customer as any).phones) && (customer as any).phones.length > 0
                                ? (customer as any).phones.map((p: any) => ({ label: p.label || "Mobile", value: p.number }))
                                : [{ label: "Mobile Number", value: typeof customer.mobile === "string" ? customer.mobile : "N/A" }]),
                        { label: "Email Address", value: customer.email || "N/A" },
                        { label: "GSTIN", value: customer.gstin || "N/A" },
                    ]
                },
                {
                    title: "Address & Financial Details",
                    fields: [
                        {
                            label: "Billing Address",
                            value: billingAddr ? (
                                <>
                                    {billingAddr.line1}
                                    {billingAddr.line2 && <><br />{billingAddr.line2}</>}
                                    <br />
                                    {[billingAddr.city, billingAddr.state].filter(Boolean).join(", ")}
                                    {billingAddr.pincode ? ` - ${billingAddr.pincode}` : ""}
                                    {billingAddr.country ? `, ${billingAddr.country}` : ""}
                                </>
                            ) : "N/A"
                        },
                        { label: "Credit Limit", value: customer.creditLimit !== undefined && customer.creditLimit !== null ? `₹ ${Number(customer.creditLimit).toLocaleString('en-IN')}` : "N/A" },
                    ]
                }
            ]}
        />
    );
};

export default CustomerViewModal;