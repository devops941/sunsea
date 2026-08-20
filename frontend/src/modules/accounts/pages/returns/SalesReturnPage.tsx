import React, { useState, useEffect, useMemo } from "react";
import { FaUndo, FaPlus, FaTimes, FaEraser, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type SalesReturn } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";

import { productService } from "../../../../services/productService";
import { salesProductService } from "../../../../services/salesProductService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonModal from "../../../../components/ui/Modal/CommonModal";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import { useUOM } from "../../../../hooks/useUOM";
import { formatStockQty, convertToPrimaryUom } from "../../../../utils/uomConversion";
import { useSocketSync } from "../../../../hooks/useSocketSync";

interface FormReturnRow {
  productId: number;
  salesInvoiceItemId?: string;
  description: string;
  productCode?: string;
  productGroup?: string;
  quantity: number;
  weight: number;
  uom: string;
  maxReturnable: number;
  unitPrice: number;
  taxRate: number;
  reason?: string;
}

const ITEMS_PER_PAGE = 10;
const UOM_OPTIONS = ["kg", "g", "t"];

export const SalesReturnPage: React.FC = () => {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedViewReturn, setSelectedViewReturn] = useState<SalesReturn | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { data: company } = useAppSelector((state) => state.company);
  const { units } = useUOM();

  // Form states
  const [customerId, setCustomerId] = useState<string>("");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [salesProductsList, setSalesProductsList] = useState<any[]>([]);

  const [narration, setNarration] = useState<string>("");
  const [returnRows, setReturnRows] = useState<FormReturnRow[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, cRes, pList, spList] = await Promise.all([
        returnService.fetchSalesReturns(),
        customerService.fetchAll({ page: 1, limit: 500 }),
        productService.fetchAll(),
        salesProductService.fetchAll(),
      ]);
      setReturns(rData || []);
      const cList = Array.isArray(cRes) ? cRes : cRes?.customers || [];
      setCustomers(cList);
      setAllProducts(pList || []);
      setSalesProductsList(Array.isArray(spList) ? spList : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sales returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketSync("salesReturn", undefined, loadData);
  useSocketSync("salesInvoice", undefined, loadData);
  useSocketSync("customer", undefined, loadData);

  // Filter Sales Products only
  const availableSalesProducts = useMemo(() => {
    const selectedCustomer = customers.find((c: any) => String(c.id) === String(customerId));
    const gradeName = selectedCustomer?.customerGrade?.name || selectedCustomer?.grade;

    const salesProductsOnly = allProducts.filter((p: any) => {
      if (p.isActive === false) return false;
      const pType = String(p.productType || "").toUpperCase();
      return pType === "SALES_PRODUCTION" || pType === "SALES";
    });

    return salesProductsOnly.map((p: any) => {
      let defaultPrice = Number(p.rate || 0);

      if (gradeName && p.gradeRates && typeof p.gradeRates === "object") {
        const gradePrice = p.gradeRates[gradeName];
        if (gradePrice !== undefined && gradePrice !== null && !isNaN(Number(gradePrice))) {
          defaultPrice = Number(gradePrice);
        }
      }

      let uomCode = String(p.uom?.code || p.uom?.uomCode || p.uom?.name || p.weightUom || "kg").toLowerCase();
      if (uomCode === "ton" || uomCode === "tonne" || uomCode === "tons") uomCode = "t";
      if (!UOM_OPTIONS.includes(uomCode)) uomCode = "kg";

      const groupName = p.category?.name || p.category?.categoryName || "Sales Group";

      return {
        productId: Number(p.id),
        productCode: p.productCode || "",
        productGroup: groupName,
        description: p.productName || p.displayName || `Product #${p.id}`,
        weight: Number(p.weightPerPiece || 0),
        uom: uomCode,
        unitPrice: defaultPrice,
        taxRate: Number(p.gstRate || 0),
      };
    });
  }, [customerId, customers, allProducts]);

  const createEmptyRow = (): FormReturnRow => ({
    productId: 0,
    description: "",
    productCode: "",
    productGroup: "",
    quantity: 0,
    weight: 0,
    uom: "kg",
    maxReturnable: 999999,
    unitPrice: 0,
    taxRate: 0,
  });

  // When Customer changes, initialize or update rows
  useEffect(() => {
    if (!customerId) {
      setReturnRows([]);
      return;
    }
    if (returnRows.length === 0) {
      setReturnRows([createEmptyRow()]);
    } else {
      setReturnRows((prev) =>
        prev.map((row) => {
          if (!row.productId) return row;
          const found = availableSalesProducts.find((p) => p.productId === row.productId);
          return found ? { ...row, unitPrice: found.unitPrice } : row;
        })
      );
    }
  }, [customerId]);

  const handleAddRow = () => {
    setReturnRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleProductSelect = (index: number, selectedProductIdStr: string) => {
    const prodId = Number(selectedProductIdStr);
    const found = availableSalesProducts.find((p) => p.productId === prodId);

    setReturnRows((prev) => {
      const updated = [...prev];
      if (found) {
        updated[index] = {
          ...updated[index],
          productId: found.productId,
          description: found.description,
          productCode: found.productCode,
          productGroup: found.productGroup,
          weight: found.weight,
          uom: found.uom,
          unitPrice: found.unitPrice,
          taxRate: found.taxRate,
          quantity: updated[index].quantity > 0 ? updated[index].quantity : 1,
        };
      } else {
        updated[index] = {
          ...updated[index],
          productId: 0,
          description: "",
          productCode: "",
          productGroup: "",
          unitPrice: 0,
        };
      }
      return updated;
    });
  };

  const handleRowFieldChange = (index: number, field: 'quantity' | 'weight' | 'unitPrice', value: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: Math.max(0, value) };
      return updated;
    });
  };

  const handleRowUomChange = (index: number, uom: string) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], uom };
      return updated;
    });
  };

  const handleRemoveRow = (index: number) => {
    setReturnRows((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  // Calculate totals
  const subTotal = returnRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const taxTotal = returnRows.reduce((sum, r) => sum + (r.quantity * r.unitPrice * r.taxRate) / 100, 0);
  const grandTotal = subTotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !company?.id) {
      toast.error("Please select a customer and ensure company context is active");
      return;
    }

    const activeReturnItems = returnRows.filter((r) => r.productId > 0 && r.quantity > 0);
    if (activeReturnItems.length === 0) {
      toast.error("Please select a product and enter a quantity greater than 0 for at least one item");
      return;
    }

    setSubmitting(true);
    try {
      await returnService.createSalesReturn({
        customerId,
        refundMode: "CREDIT_NOTE",
        reason: "Sales Return",
        narration,
        companyId: company.id,
        items: activeReturnItems.map((r) => ({
          productId: r.productId,
          quantity: r.quantity,
          weight: r.weight,
          uom: r.uom,
          unitPrice: r.unitPrice,
          taxRate: r.taxRate,
          reason: r.reason || "Sales Return",
        })),
      });

      toast.success("Sales Return processed & auto-posted to inventory & accounting!");
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create Sales Return");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setReturnRows([]);
    setNarration("");
  };

  const filteredReturns = returns.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.returnNo?.toLowerCase().includes(term) ||
      r.customer?.firmName?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE) || 1;
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Returns (Credit Note)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer sales returns, inventory auto-restock, and credit notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search sales returns..."
          />
          <CustomButton
            text="Process Sales Return"
            icon={FaPlus}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={paginatedReturns}
        rowKey={(item) => item.id}
        loading={loading}
        emptyMessage="No sales return records found."
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page) => setCurrentPage(page),
        }}
        columns={[
          {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
          },
          {
            header: "RETURN NO",
            render: (item) => (
              <button
                onClick={() => setSelectedViewReturn(item)}
                className="font-mono font-bold text-blue-600 hover:underline text-left"
                title="Click to view Sales Return Details"
              >
                {item.returnNo}
              </button>
            ),
          },
          {
            header: "DATE",
            render: (item) => new Date(item.returnDate).toLocaleDateString("en-IN"),
          },
          {
            header: "CUSTOMER",
            render: (item) => item.customer?.firmName || "-",
          },
          {
            header: "REFUND MODE",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {item.refundMode || "CREDIT_NOTE"}
              </span>
            ),
          },
          {
            header: "STATUS",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {item.status}
              </span>
            ),
          },
          {
            header: "GRAND TOTAL",
            align: "right",
            render: (item) => (
              <span className="font-semibold text-blue-600">
                ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            ),
          },
          {
            header: "REASON",
            render: (item) => <span className="text-slate-500 max-w-xs truncate block">{item.reason || "-"}</span>,
          },
          {
            header: "ACTIONS",
            render: (item) => (
              <div className="flex items-center gap-2">
                <ViewButton onClick={() => setSelectedViewReturn(item)} />
              </div>
            ),
          },
        ]}
      />

      {/* New Sales Return Modal */}
      <CommonModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="New Sales Return (Credit Note)"
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <CustomButton
              text="Clear"
              icon={FaEraser}
              onClick={resetForm}
              disabled={submitting}
              type="button"
            />
            <CustomButton
              type="submit"
              text={submitting ? "Processing Return..." : "Submit Return"}
              icon={FaSave}
              variant="primary"
              disabled={submitting}
              onClick={handleSubmit}
            />
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
          <div>
            <SelectInput
              label="CUSTOMER"
              name="customerId"
              value={customerId}
              required
              defaultOptionLabel="Select Customer"
              searchable
              options={customers.map((c: any) => {
                const name = c.displayName || c.firmName;
                const rawGrade = c.customerGrade?.name || c.grade || "";
                const gradeShort = rawGrade ? rawGrade.replace(/grade\s*/i, "").trim() : "";
                const gradeTag = gradeShort ? `(${gradeShort})` : null;

                const location = c.billingCity || c.city || c.shippingCity || c.customerType?.name;
                const locationTag = location ? `(${location.toLowerCase()})` : null;

                const parts = [name, gradeTag, locationTag].filter(Boolean);
                return { label: parts.join(' - '), value: String(c.id) };
              })}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>

          {/* Items Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Return Line Items</label>
              <CustomButton
                text="Add Item"
                icon={FaPlus}
                onClick={handleAddRow}
                variant="primary"
                size="sm"
                type="button"
              />
            </div>

            {returnRows.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <span>No line items added.</span>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  + Click here to add item
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 uppercase font-semibold text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 min-w-[220px]">Product & Group</th>
                      <th className="px-3 py-3 w-24 text-center">Qty</th>
                      <th className="px-3 py-3 w-44 text-center">Weight / UOM</th>
                      <th className="px-3 py-3 w-32 text-center">Unit Price (₹)</th>
                      <th className="px-3 py-3 w-32 text-right">Total (₹)</th>
                      <th className="px-3 py-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {returnRows.map((row, idx) => {
                      const lineTot = row.quantity * row.unitPrice;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 ${row.quantity > 0 ? 'bg-blue-50/40' : ''}`}>
                          <td className="px-3 py-2.5 align-middle min-w-[220px]">
                            <SelectInput
                              name={`product-${idx}`}
                              value={row.productId ? String(row.productId) : ""}
                              defaultOptionLabel="-- Select Product --"
                              searchable
                              noMargin
                              options={availableSalesProducts.map((p) => ({
                                label: p.productGroup ? `${p.description} — (${p.productGroup})` : p.description,
                                value: String(p.productId),
                              }))}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.quantity || ""}
                              onChange={(e) => handleRowFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-20 h-10 px-2 border border-slate-200 rounded-md text-center font-bold text-blue-600 focus:outline-none focus:border-blue-500 text-sm shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center min-w-[170px]">
                            <QuantityInput
                              hideLabel
                              name={`weight-${idx}`}
                              value={row.weight || ""}
                              baseUoms="kg, g, t"
                              uom={row.uom || "kg"}
                              onChange={(e: any) => handleRowFieldChange(idx, 'weight', parseFloat(e.target.value) || 0)}
                              onUomChange={(newUom: string) => handleRowUomChange(idx, newUom)}
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unitPrice || ""}
                              onChange={(e) => handleRowFieldChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-28 h-10 px-3 border border-slate-200 rounded-md text-center text-slate-700 focus:outline-none focus:border-blue-500 text-sm font-medium shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-middle text-right">
                            <div className="h-10 flex items-center justify-end font-mono font-bold text-slate-900 text-sm">
                              {lineTot > 0 ? `₹${lineTot.toFixed(2)}` : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-center">
                            
                              <DeleteButton 
                                onClick={() => handleRemoveRow(idx)}
                              > 
                              </DeleteButton> 
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          {returnRows.some(r => r.quantity > 0) && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col items-end space-y-1 text-xs">
              <div className="flex justify-between w-48 font-bold text-slate-900 text-sm">
                <span>Total:</span>
                <span className="font-mono text-blue-600">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <TextInput
            label="NARRATION / INTERNAL NOTES"
            name="narration"
            value={narration}
            as="textarea"
            rows={2}
            placeholder="Additional accounting notes..."
            onChange={(e) => setNarration(e.target.value)}
          />
        </form>
      </CommonModal>

      {/* Sales Return Detail Modal using CommonViewModal */}
      <CommonViewModal
        show={Boolean(selectedViewReturn)}
        onHide={() => setSelectedViewReturn(null)}
        modalTitle="Sales Return Details"
        avatarText={selectedViewReturn?.returnNo ? "SR" : ""}
        headerTitle={selectedViewReturn?.returnNo || ""}
        headerSubtitle={selectedViewReturn?.customer?.firmName || ""}
        statusNode={
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            {selectedViewReturn?.status || "COMPLETED"}
          </span>
        }
        sections={[
          {
            fields: [
              { label: "Return Date", value: selectedViewReturn ? new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN") : "-" },
              { label: "Customer", value: selectedViewReturn?.customer?.firmName || "-" },
              { label: "Sales Invoice", value: selectedViewReturn?.salesInvoiceId ? `INV #${selectedViewReturn.salesInvoiceId}` : "Direct Return" },
              { label: "Refund Mode", value: selectedViewReturn?.refundMode || "CREDIT_NOTE" },
              { label: "Grand Total", value: selectedViewReturn ? `₹${Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-" },
            ],
          },
        ]}
        customContent={
          selectedViewReturn && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wider">
                  Returned Items List
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="px-3 py-2.5">Product ID / Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5 text-center">Weight / UOM</th>
                        <th className="px-3 py-2.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-right">Tax Rate</th>
                        <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {item.product?.productName || item.description || `Product #${item.productId}`}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-center font-medium text-slate-700">
                              {item.weight != null ? formatStockQty(item.weight, item.uom) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                              {item.taxRate || 0}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                              ₹{Number(item.lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">Narration / Notes:</span>
                  <p className="text-slate-600 leading-relaxed">{selectedViewReturn.narration}</p>
                </div>
              )}
            </div>
          )
        }
      />
    </div>
  );
};
