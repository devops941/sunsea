import React, { useState, useEffect, useMemo } from "react";
import { FaPrint, FaDownload, FaArrowLeft, FaWhatsapp } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CustomButton from "../../../../components/ui/Button/Button";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { rawMaterialService } from "../../../../services/rawMaterialService";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const ROWS_PER_PAGE = 20;

const PoInvoicePage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

    const [po, setPo] = useState<any>(null);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            purchaseOrderService.fetchById(id),
            rawMaterialService.fetchAll().catch(() => []),
        ])
            .then(([poData, materials]) => {
                setPo(poData);
                setRawMaterials(materials || []);
            })
            .catch(() => {
                toast.error("Failed to load Purchase Order details");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [id]);

    const supplier = po?.supplier;

    const isInterState = useMemo(() => {
        if (!companyState || !po?.billingState) return false;
        return companyState.toLowerCase().trim() !== po.billingState.toLowerCase().trim();
    }, [companyState, po?.billingState]);

    const itemsWithTax = useMemo(() => {
        if (!po?.items) return [];
        return po.items.map((item: any) => {
            const qty = Number(item.quantity ?? 0);
            const rate = Number(item.unitPrice ?? 0);
            const amount = Number(item.taxableAmount ?? qty * rate);
            const taxPercent = Number(item.tax ?? 0);

            const cgstRate = isInterState ? 0 : taxPercent / 2;
            const sgstRate = isInterState ? 0 : taxPercent / 2;
            const igstRate = isInterState ? taxPercent : 0;

            const cgstAmount = Number(item.cgstAmount ?? (amount * cgstRate) / 100);
            const sgstAmount = Number(item.sgstAmount ?? (amount * sgstRate) / 100);
            const igstAmount = Number(item.igstAmount ?? (amount * igstRate) / 100);

            const totalAmount = amount + cgstAmount + sgstAmount + igstAmount;

            const rm = (rawMaterials || []).find(
                (m: any) => String(m.rawMaterialId) === String(item.productId) || String(m.id) === String(item.productId)
            );

            const description = item.description || item.product?.productName || item.product?.materialName || item.rawMaterial?.materialName || rm?.materialName || item.productId || "N/A";
            const hsnCode = item.hsnCode || item.product?.hsnCode || item.rawMaterial?.hsnCode || rm?.hsnCode || "";

            return {
                ...item,
                description,
                hsnCode,
                qty,
                rate,
                amount,
                unit: item.uom || "Pcs.",
                cgstRate,
                sgstRate,
                igstRate,
                cgstAmount,
                sgstAmount,
                igstAmount,
                totalAmount,
            };
        });
    }, [po, rawMaterials, isInterState]);

    const totalQty = useMemo(() => itemsWithTax.reduce((s: number, i: any) => s + i.qty, 0), [itemsWithTax]);
    const grandTotal = useMemo(() => {
        const totalTaxable = itemsWithTax.reduce((s: number, i: any) => s + i.amount, 0);
        const totalCgst = itemsWithTax.reduce((s: number, i: any) => s + i.cgstAmount, 0);
        const totalSgst = itemsWithTax.reduce((s: number, i: any) => s + i.sgstAmount, 0);
        const totalIgst = itemsWithTax.reduce((s: number, i: any) => s + i.igstAmount, 0);
        return Number(po?.netAmount ?? (totalTaxable + totalCgst + totalSgst + totalIgst));
    }, [po, itemsWithTax]);

    const handleDownloadPdf = async () => {
        try {
            const html2canvas = (await import("html2canvas-pro")).default;
            const { jsPDF } = await import("jspdf");

            const element = document.getElementById("printable-po-invoice-card");
            if (!element) return;

            const canvas = await html2canvas(element, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");
            const margin = 10;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pageWidth - 2 * margin;
            const availableHeight = pageHeight - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const renderHeight = imgHeight < availableHeight ? availableHeight : imgHeight;

            let heightLeft = renderHeight;
            let position = margin;

            pdf.addImage(imgData, "PNG", margin, position, imgWidth, renderHeight);
            heightLeft -= availableHeight;

            while (heightLeft > 0) {
                position -= availableHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
                heightLeft -= availableHeight;
            }

            pdf.save(`${po?.poNumber || "PO-Invoice"}.pdf`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF");
        }
    };

    const handleSendWhatsapp = () => {
        if (!po) return;
        const supplierPhone = supplier?.phone || "";
        const formattedPhone = supplierPhone.replace(/\D/g, "");

        const message = `Dear ${supplier?.supplierName || "Supplier"},\n\nPlease find attached our Purchase Order details:\nPO Number: ${po.poNumber}\nPO Date: ${formatDate(po.poDate)}\nTotal Amount: ₹${formatMoney(po.netAmount)}\n\nLink to view: ${window.location.href}\n\nThank you!\nFor ${company?.legalName || company?.companyName || "Company"}`;

        const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, "_blank");
    };

    if (loading) {
        return <CommonLoader text="Loading order details..." fullScreen={false} />;
    }

    if (!po) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-ink-subtle">
                <p className="text-base font-semibold">Purchase Order not found.</p>
            </div>
        );
    }

    // Extract supplier address
    const supplierAddress = (() => {
        const line1 = po.billingAddressLine1 || supplier?.billingAddressLine1 || "";
        const city = po.billingCity || supplier?.billingCity || "";
        const state = po.billingState || supplier?.billingState || "";
        const pincode = po.billingPincode || supplier?.billingPincode || "";
        const cityStatePin = [city, state].filter(Boolean).join(", ") + (pincode ? ` - ${pincode}` : "");
        return { line1, cityStatePin };
    })();

    const emptyRowCount = Math.max(0, ROWS_PER_PAGE - itemsWithTax.length);

    return (
        <div className="w-full mx-auto p-6 lg:p-8 print:p-0 print:block bg-gray-100 min-h-screen">
            <div className="max-w-5xl mx-auto">
                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 no-print">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/purchase-orders")}
                            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-semibold bg-transparent border-none outline-none cursor-pointer"
                        >
                            <FaArrowLeft className="text-xs" /> Back
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 m-0">
                            PO Invoice #{po.poNumber}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <CustomButton text="Send WhatsApp" icon={FaWhatsapp} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none" onClick={handleSendWhatsapp} />
                        <CustomButton text="Print" icon={FaPrint} variant="primary" onClick={() => window.print()} />
                        <CustomButton text="Download PDF" icon={FaDownload} variant="secondary" onClick={handleDownloadPdf} />
                    </div>
                </div>

                {/* Print stylesheet */}
                <style>{`
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 8mm;
                        }
                        body * {
                            visibility: hidden !important;
                        }
                        #printable-po-invoice-card, #printable-po-invoice-card * {
                            visibility: visible !important;
                        }
                        #printable-po-invoice-card {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            min-height: auto !important;
                            background: #fff !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        html, body {
                            height: auto;
                            overflow: visible !important;
                        }
                    }
                `}</style>

                {/* PO Document Card */}
                <div
                    id="printable-po-invoice-card"
                    className="font-sans text-black bg-white border border-black w-full min-h-[262mm] flex flex-col box-border shadow-lg"
                >
                    {/* Header */}
                    <div className="text-center border-b border-black py-[15px] px-[10px] shrink-0">
                        <div className="text-[12px] uppercase font-bold tracking-[2px] mb-[2px]">Purchase Order</div>
                        <h1 className="text-[24px] font-extrabold m-0 tracking-[3px]">PURCHASE ORDER</h1>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            {/* Supplier Details + Order Details */}
                            <div className="flex border-b border-black">
                                {/* Supplier Details */}
                                <div className="flex-[1.2] border-r border-black p-3 text-[14px] leading-[1.5]">
                                    <div className="font-bold mb-1">Supplier Details :</div>
                                    <div className="font-semibold text-slate-800">
                                        {supplier?.supplierName || supplier?.legalName || supplier?.displayName || "N/A"}
                                    </div>
                                    <div className="text-slate-600 mt-1">
                                        {supplierAddress.line1 && <div>{supplierAddress.line1}</div>}
                                        {supplierAddress.cityStatePin && <div>{supplierAddress.cityStatePin}</div>}
                                        {!supplierAddress.line1 && !supplierAddress.cityStatePin && (
                                            <div className="text-slate-400 italic">Address not specified</div>
                                        )}
                                    </div>
                                    {supplier?.gstin && (
                                        <div className="mt-1 text-[13px]">GSTIN : {supplier.gstin}</div>
                                    )}
                                </div>
                                {/* Order Details */}
                                <div className="flex-[0.8] p-3 text-[14px] leading-[1.6]">
                                    <div className="flex mb-1.5">
                                        <span className="w-[90px] font-bold">Order No.</span>
                                        <span className="flex-1">: {po.poNumber}</span>
                                    </div>
                                    <div className="flex mb-1.5">
                                        <span className="w-[90px] font-bold">Dated</span>
                                        <span className="flex-1">: {formatDate(po.poDate)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Intro text */}
                            <div className="px-3 py-2.5 text-[14px] border-b border-black text-slate-700">
                                We are pleased to place the order for the following items :
                            </div>

                            {/* Items Table */}
                            <table className="w-full border-collapse text-[14px]">
                                <thead>
                                    <tr style={{ height: "32px" }}>
                                        <th className="text-center border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "45px" }}>S.N.</th>
                                        <th className="text-left border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]">Description of Goods</th>
                                        <th className="text-center border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "80px" }}>HSN/SAC</th>
                                        <th className="text-right border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "70px" }}>Qty.</th>
                                        <th className="text-center border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "70px" }}>Unit</th>
                                        <th className="text-right border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "90px" }}>Rate (₹)</th>
                                        <th className="text-right border border-black px-2.5 py-0 align-middle font-bold bg-[#f7f7f7]" style={{ width: "100px" }}>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsWithTax.map((item: any, idx: number) => (
                                        <tr key={item.id || idx} style={{ height: "28px" }}>
                                            <td className="text-center border border-black px-2.5 py-0 align-middle">{idx + 1}.</td>
                                            <td className="border border-black px-2.5 py-0 align-middle font-medium text-slate-800">{item.description}</td>
                                            <td className="text-center border border-black px-2.5 py-0 align-middle text-slate-600">{item.hsnCode || "—"}</td>
                                            <td className="text-right border border-black px-2.5 py-0 align-middle font-bold">{item.qty}</td>
                                            <td className="text-center border border-black px-2.5 py-0 align-middle text-slate-600">{item.unit}</td>
                                            <td className="text-right border border-black px-2.5 py-0 align-middle">{formatMoney(item.rate)}</td>
                                            <td className="text-right border border-black px-2.5 py-0 align-middle font-semibold">{formatMoney(item.amount)}</td>
                                        </tr>
                                    ))}
                                    {/* Empty rows to fill the page */}
                                    {Array.from({ length: emptyRowCount }).map((_, idx) => (
                                        <tr key={`empty-${idx}`} style={{ height: "28px" }}>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                            <td className="border border-black px-2.5 py-0 align-middle"></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold bg-[#f7f7f7] border-t border-black" style={{ height: "32px" }}>
                                        <td colSpan={3} className="text-right border border-black px-4 py-0 align-middle font-bold text-[14px]">
                                            Grand Total
                                        </td>
                                        <td className="text-right border border-black px-2.5 py-0 align-middle font-bold text-[14px]">
                                            {totalQty}
                                        </td>
                                        <td className="text-center border border-black px-2.5 py-0 align-middle text-[14px]">
                                            {itemsWithTax[0]?.unit || "Pcs."}
                                        </td>
                                        <td className="border border-black px-2.5 py-0 align-middle"></td>
                                        <td className="text-right border border-black px-2.5 py-0 align-middle font-bold text-[14px]">
                                            ₹{formatMoney(grandTotal)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Authorised Signatory Block */}
                        <div className="mt-4 mb-3 flex justify-end px-4">
                            <div className="text-right pt-2 min-w-[200px]">
                                <div className="text-[14px] font-semibold text-slate-700 mb-6">
                                    for {company?.legalName || company?.companyName || "Company"}
                                </div>
                                <div className="font-bold text-[14px] text-slate-900 border-t border-black pt-1">
                                    Authorised Signatory
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PoInvoicePage;
