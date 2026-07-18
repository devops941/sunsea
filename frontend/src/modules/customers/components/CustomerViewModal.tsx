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
                        { label: "Mobile Number", value: customer.mobile || "N/A" },
                        { label: "Alternative Phone", value: customer.altPhone || "N/A" },
                        { label: "WhatsApp Number", value: customer.whatsapp || "N/A" },
                        { label: "Email Address", value: customer.email || "N/A" }
                    ]
                },
                {
                    title: "GST & Statutory Information",
                    fields: [
                        { label: "GSTIN", value: customer.gstin || "N/A" },
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
                                    {customer.billingPincode || "N/A"}
                                </>
                            )
                        },
                        {
                            label: "Shipping Address",
                            value: (
                                <>
                                    {customer.shippingAddressLine1 || "N/A"}
                                    <br />
                                    {customer.shippingCity || "N/A"},{" "}
                                    {customer.shippingState || "N/A"} -{" "}
                                    {customer.shippingPincode || "N/A"}
                                </>
                            )
                        }
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