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

    // Helper to render bank details within custom content
    const renderBankDetails = () => {
        if (!customer.bankAccount) return null;

        let bankAccounts: any[] = [];
        if (Array.isArray(customer.bankAccount)) {
            bankAccounts = customer.bankAccount;
        } else if (typeof customer.bankAccount === "object") {
            bankAccounts = [customer.bankAccount];
        } else {
            return null;
        }

        if (bankAccounts.length === 0) return null;

        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <h6 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Bank Account Details</h6>
                </div>
                <div className="p-5 space-y-5">
                    {bankAccounts.map((bank, idx) => (
                        <div key={idx} className={idx > 0 ? "pt-5 border-t border-slate-100" : ""}>
                            {bankAccounts.length > 1 && (
                                <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bank Account #{idx + 1}</h6>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-5 gap-x-8">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Holder Name</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.bankHolderName || "N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bank Name</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.bankName || "N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Number</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.accountNumber || "N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">IFSC Code</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.ifscCode || "N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Branch Name</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.branchName || "N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">GPay / PhonePe Number</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">{bank.upiMobileNumber || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

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
            headerSubtitle={`${customer.customerCode || "N/A"} | ${customer.customerType || "N/A"}`}
            statusNode={
                <StatusBadge status={customer.status === "Active" ? "ACTIVE" : "INACTIVE"} />
            }
            sections={[
                {
                    title: "Customer Information",
                    fields: [
                        { label: "Customer Code", value: customer.customerCode || "N/A" },
                        { label: "Customer Type", value: customer.customerType || "N/A" }
                    ]
                },
                {
                    title: "Basic Information",
                    fields: [
                        { label: "Firm Name", value: customer.firmName || "N/A" },
                        { label: "Display Name", value: customer.displayName || "N/A" },
                        { label: "Contact Person", value: customer.contactPerson || "N/A" },
                        { label: "Designation", value: customer.designation || "N/A" }
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
                        { label: "Credit Days", value: customer.creditDays !== undefined && customer.creditDays !== null ? `${customer.creditDays} Days` : "0 Days" },
                        { label: "Price List", value: customer.priceList || "N/A" }
                    ]
                }
            ]}
            customContent={renderBankDetails()}
        />
    );
};

export default CustomerViewModal;