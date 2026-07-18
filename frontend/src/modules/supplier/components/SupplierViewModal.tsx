import React from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

interface SupplierViewModalProps {
    show: boolean;
    onHide: () => void;
    supplier: any;
}

const SupplierViewModal: React.FC<SupplierViewModalProps> = ({
    show,
    onHide,
    supplier,
}) => {
    if (!supplier) return null;

    // Helper to render bank details within custom content
    const renderBankDetails = () => {
        if (!supplier.bankAccount) return null;

        let bankAccounts: any[] = [];
        if (Array.isArray(supplier.bankAccount)) {
            bankAccounts = supplier.bankAccount;
        } else if (typeof supplier.bankAccount === "object") {
            bankAccounts = [supplier.bankAccount];
        } else if (typeof supplier.bankAccount === "string" && supplier.bankAccount.trim() !== "") {
            return (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                        <h6 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Bank Account Details</h6>
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-5 gap-x-8">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Holder Name</span>
                            <span className="text-sm font-medium text-slate-800 break-words">{supplier.bankHolder || "N/A"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account Number</span>
                            <span className="text-sm font-medium text-slate-800 break-words">{supplier.bankAccount || "N/A"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">IFSC Code</span>
                            <span className="text-sm font-medium text-slate-800 break-words">{supplier.bankIfsc || "N/A"}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">UPI ID</span>
                            <span className="text-sm font-medium text-slate-800 break-words">{supplier.upiId || "N/A"}</span>
                        </div>
                    </div>
                </div>
            );
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

    // Helper to render additional plant/delivery addresses
    const renderAdditionalAddresses = () => {
        if (!Array.isArray(supplier.addresses) || supplier.addresses.length === 0) return null;

        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <h6 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Additional Delivery / Plant Addresses</h6>
                </div>
                <div className="p-5 space-y-5">
                    {supplier.addresses.map((addr, idx) => (
                        <div key={idx} className={idx > 0 ? "pt-5 border-t border-slate-100" : ""}>
                            <div className="flex items-center gap-2 mb-3">
                                <h6 className="text-sm font-bold text-slate-700">{addr.label || `Address #${idx + 1}`}</h6>
                                {addr.isDefault && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md uppercase tracking-wider">
                                        Default
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Address</span>
                                    <span className="text-sm font-medium text-slate-800 break-words">
                                        {addr.address?.addressLine1 || "N/A"}
                                        {addr.address?.addressLine2 ? `, ${addr.address.addressLine2}` : ""}
                                        <br />
                                        {addr.address?.city || "N/A"}, {addr.address?.state || "N/A"} - {addr.address?.pincode || "N/A"}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">State Code</span>
                                    <span className="text-sm font-medium text-slate-800">{addr.stateCode || "N/A"}</span>
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
            modalTitle="Supplier Details"
            avatarText={supplier.displayName?.charAt(0).toUpperCase() || supplier.legalName?.charAt(0).toUpperCase() || "S"}
            headerTitle={supplier.displayName || supplier.legalName || "N/A"}
            headerSubtitle={`${supplier.supplierCode || "N/A"} | ${supplier.vendorType || "N/A"}`}
            statusNode={
                <StatusBadge status={supplier.status === "Active" ? "ACTIVE" : "INACTIVE"} />
            }
            sections={[
                {
                    title: "Supplier Information",
                    fields: [
                        { label: "Supplier Code", value: supplier.supplierCode || "N/A" },
                        { label: "Raw Material Categories", value: supplier.rawMaterialCategories || "N/A" },
                        { label: "Raw Materials", value: supplier.category || "N/A" }
                    ]
                },
                {
                    title: "Basic Information",
                    fields: [
                        { label: "Legal Name", value: supplier.legalName || "N/A" },
                        { label: "Display Name", value: supplier.displayName || "N/A" },
                        { label: "Vendor Type", value: supplier.vendorType || "N/A" },
                        { label: "Contact Person", value: supplier.contactPerson || "N/A" },
                        { label: "Designation", value: supplier.designation || "N/A" }
                    ]
                },
                {
                    title: "Contact Information",
                    fields: [
                        { label: "Mobile Number", value: supplier.mobile || "N/A" },
                        { label: "Alternative Phone", value: supplier.altPhone || "N/A" },
                        { label: "WhatsApp Number", value: supplier.whatsapp || "N/A" },
                        { label: "Email Address", value: supplier.email || "N/A" },
                        
                    ]
                },
                {
                    title: "GST & MSME Information",
                    fields: [
                        { label: "GSTIN", value: supplier.gstin || "N/A" },
                        { label: "PAN", value: supplier.pan || "N/A" },
                        { label: "GST Registration Type", value: supplier.gstRegType || "N/A" },
                        { label: "State Code", value: supplier.stateCode || "N/A" }
                    ]
                },
                {
                    title: "Billing Address",
                    fields: [
                        {
                            label: "Address",
                            value: (() => {
                                const line1 = supplier.billingAddressLine1 || supplier.billingAddress?.addressLine1 || "N/A";
                                const line2 = supplier.billingAddressLine2 || supplier.billingAddress?.addressLine2 || "";
                                const city = supplier.billingCity || supplier.billingAddress?.city || "N/A";
                                const state = supplier.billingState || supplier.billingAddress?.state || "N/A";
                                const pincode = supplier.billingPincode || supplier.billingAddress?.pincode || "N/A";
                                return (
                                    <>
                                        {line1}
                                        {line2 ? `, ${line2}` : ""}
                                        <br />
                                        {city}, {state} - {pincode}
                                    </>
                                );
                            })(),
                            xs: 12
                        }
                    ]
                },
                {
                    title: "Commercial Settings",
                    fields: [
                        { label: "Payment Terms", value: supplier.paymentTerms || "N/A" },
                        { label: "Lead Time (Days)", value: supplier.leadTimeDays !== undefined ? `${supplier.leadTimeDays} Days` : "N/A" },
                        { label: "Min Order Qty", value: supplier.minOrderQty !== undefined ? supplier.minOrderQty : "N/A" },
                        { label: "Currency", value: supplier.currency || "INR" }
                    ]
                }
            ]}
            customContent={
                <>
                    {renderBankDetails()}
                    {renderAdditionalAddresses()}
                </>
            }
        />
    );
};

export default SupplierViewModal;