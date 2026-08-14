import React from "react";
import type { Customer } from "../../../features/customer/types";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

interface CustomerViewModalProps {
    show: boolean;
    onHide: () => void;
    customer: Customer | null;
}

const CustomerViewModal: React.FC<CustomerViewModalProps> = ({
    show,
    onHide,
    customer,
}) => {
    if (!customer) return null;

    const getShippingAddresses = () => {
        const list: Array<{ line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string; label?: string }> = [];

        if (Array.isArray(customer.addresses) && customer.addresses.length > 0) {
            customer.addresses.forEach((addrItem: any, idx: number) => {
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
                const label = addrItem.label || `Address #${idx + 1}`;

                if (line1 || city || state || pincode) {
                    list.push({ line1, line2, city, state, pincode, country, label });
                }
            });
        }

        if (list.length === 0 && customer.shippingAddressLine1) {
            list.push({
                line1: customer.shippingAddressLine1,
                line2: (customer as any).shippingAddressLine2 || "",
                city: customer.shippingCity || "",
                state: customer.shippingState || "",
                pincode: customer.shippingPincode || "",
                country: (customer as any).shippingCountry || (customer as any).shippingAddressCountry || "India",
                label: "Shipping Address",
            });
        }

        return list;
    };

    const shippingAddresses = getShippingAddresses();

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
                    title: "Customer Information",
                    fields: [
                        { label: "Customer Code", value: customer.customerCode || "N/A" }
                    ]
                },
                {
                    title: "Basic Information",
                    fields: [
                        { label: "Firm Name", value: customer.firmName || "N/A" },
                        { label: "Display Name", value: customer.displayName || "N/A" }
                    ]
                },
                {
                    title: "Contact Information",
                    fields: [
                        ...(Array.isArray(customer.mobile) && customer.mobile.length > 0
                            ? customer.mobile.map((p: any) => ({ label: p.label || "Phone", value: p.number }))
                            : (customer as any).phones && Array.isArray((customer as any).phones) && (customer as any).phones.length > 0
                                ? (customer as any).phones.map((p: any) => ({ label: p.label || "Phone", value: p.number }))
                                : [{ label: "Mobile Number", value: typeof customer.mobile === "string" ? customer.mobile : "N/A" }]),
                        { label: "Email Address", value: customer.email || "N/A" }
                    ]
                },
                {
                    title: "GST & Statutory Information",
                    fields: [
                        { label: "GSTIN", value: customer.gstin || "N/A" },
                        { label: "State Code", value: (customer as any).stateCode || "N/A" },
                    ]
                },
                {
                    title: "Address Information",
                    fields: [
                        {
                            label: "Billing Address",
                            value: (
                                <>
                                    {customer.billingAddressLine1 || "N/A"}
                                    <br />
                                    {customer.billingCity || "N/A"},{" "}
                                    {customer.billingState || "N/A"} -{" "}
                                    {customer.billingPincode || "N/A"},{" "}
                                    {(customer as any).billingCountry || (customer as any).billingAddressCountry || "India"}
                                </>
                            )
                        },
                        ...(shippingAddresses.length > 0
                            ? shippingAddresses.map((addr, idx) => ({
                                label: shippingAddresses.length > 1 ? `Shipping Address #${idx + 1}` : "Shipping Address",
                                value: (
                                    <>
                                        {addr.line1}
                                        {addr.line2 && <><br />{addr.line2}</>}
                                        <br />
                                        {addr.city || "N/A"}, {addr.state || "N/A"} - {addr.pincode || "N/A"}, {addr.country || "India"}
                                    </>
                                )
                            }))
                            : [{
                                label: "Shipping Address",
                                value: "N/A"
                            }]
                        )
                    ]
                },
                {
                    title: "Commercial Settings",
                    fields: [
                        { label: "Credit Limit", value: `₹ ${customer.creditLimit !== undefined && customer.creditLimit !== null ? customer.creditLimit : 0}` },
                        { label: "Price List", value: customer.priceList || "N/A" }
                    ]
                }
            ]}
        />
    );
};

export default CustomerViewModal;