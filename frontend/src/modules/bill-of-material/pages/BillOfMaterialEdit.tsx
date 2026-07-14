import React, { useState, useEffect } from "react";
import { FaSave, FaArrowLeft, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import Button from "../../../components/ui/Button/Button";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { productService } from "../../../services/productService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { uomService } from "../../../services/uomService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";
import { toast } from "react-toastify";

const BillOfMaterialEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const bomData = location.state;

    const billOfMaterialItemSchema = z.object({
        rawMaterialId: z.string().trim().min(1, "Raw Material is required"),
        requiredQuantity: z.union([z.string(), z.number()])
            .transform(val => Number(val))
            .refine(val => !isNaN(val) && val > 0, { message: "Required Quantity must be a valid number greater than 0" }),
        uom: z.string().trim().min(1, "UOM is required"),
    });

    const billOfMaterialSchema = z.object({
        productId: z.string().trim().min(1, "Product is required"),
        remarks: z.string().trim().max(500, "Remarks cannot exceed 500 characters").optional().or(z.literal("")),
        items: z.array(billOfMaterialItemSchema).min(1, "At least one Raw Material is required"),
    }).superRefine((data, ctx) => {
        const ids = data.items.map(item => item.rawMaterialId);
        ids.forEach((id, index) => {
            if (ids.indexOf(id) !== index) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["items", index, "rawMaterialId"],
                    message: "Duplicate Raw Material is not allowed",
                });
            }
        });
    });

    const [formData, setFormData] = useState({
        id: "",
        productId: "",
        remarks: "",
        items: [
            {
                rawMaterialId: "",
                requiredQuantity: "",
                uom: "",
            },
        ],
    });

    const [products, setProducts] = useState<any[]>([]);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    const [uoms, setUoms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<any>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                const fetchedProducts = await productService.fetchAll();
                setProducts(fetchedProducts);

                const fetchedRawMaterials = await rawMaterialService.fetchAll();
                setRawMaterials(fetchedRawMaterials);

                const fetchedUoms = await uomService.fetchAll();
                setUoms(fetchedUoms);
            } catch (error) {
                console.error("Failed to load products, raw materials, or UOMs", error);
                toast.error("Failed to load initial data.");
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (bomData) {
            setFormData({
                id: bomData.id?.toString() || "",
                productId: bomData.productId?.toString() || "",
                remarks: bomData.remarks || "",
                items: bomData.items && bomData.items.length > 0
                    ? bomData.items.map((item: any) => ({
                        rawMaterialId: item.rawMaterialId?.toString() || "",
                        requiredQuantity: item.requiredQuantity?.toString() || "",
                        uom: item.uom || "",
                    }))
                    : [{ rawMaterialId: "", requiredQuantity: "", uom: "" }]
            });
        }
    }, [bomData]);

    const addRow = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    rawMaterialId: "",
                    requiredQuantity: "",
                    uom: "",
                },
            ],
        }));
    };

    const removeRow = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleItemChange = (e: any) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
        
        if (errors[name]) {
            setErrors({ ...errors, [name]: undefined });
        }
    };

    const handleRowChange = (index: number, field: string, value: string) => {
        const updatedItems = [...formData.items];
        updatedItems[index] = {
            ...updatedItems[index],
            [field]: value,
        };
        setFormData({
            ...formData,
            items: updatedItems,
        });
        
        const errorKey = `items.${index}.${field}`;
        if (errors[errorKey]) {
            setErrors({ ...errors, [errorKey]: undefined });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // Validate form data
            billOfMaterialSchema.parse(formData);

            setIsLoading(true);
            const payload = {
                productId: Number(formData.productId),
                remarks: formData.remarks,
                items: formData.items.map(item => ({
                    rawMaterialId: item.rawMaterialId,
                    requiredQuantity: Number(item.requiredQuantity),
                    uom: item.uom,
                }))
            };

            await billOfMaterialService.update(formData.id, payload);
            toast.success("Bill of Material updated successfully!");
            navigate("/bill-of-materials");
        } catch (error: any) {
            console.error("Failed to update BOM:", error);

            if (error instanceof z.ZodError) {
                const issues = error.issues;
                const fieldErrors: any = {};
                issues.forEach(issue => {
                    const path = issue.path.join(".");
                    fieldErrors[path] = issue.message;
                });
                setErrors(fieldErrors);
                toast.error("Please fix the validation errors below.");
            } else if (error.response?.data?.message) {
                toast.error("Server Error: " + error.response.data.message);
            } else {
                toast.error("Failed to update Bill of Material.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="w-full max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            Edit Bill Of Material
                        </h2>
                    </div>
                    <div>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/bill-of-materials")}
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <TextInput
                                    label="BOM ID"
                                    name="id"
                                    value={formData.id}
                                    placeholder="Auto Generated"
                                    disabled
                                    onChange={() => { }}
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <SelectInput
                                    label="PRODUCT"
                                    name="productId"
                                    value={formData.productId}
                                    required
                                    disabled
                                    error={errors.productId}
                                    options={[
                                        { value: "", label: "Select Product" },
                                        ...products.map(p => ({
                                            value: p.id.toString(),
                                            label: `${p.productName} (${p.productCode})`
                                        }))
                                    ]}
                                    onChange={handleItemChange}
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                <TextInput
                                    label="REMARKS"
                                    name="remarks"
                                    value={formData.remarks}
                                    error={errors.remarks}
                                    placeholder="Enter remarks (Optional)"
                                    onChange={handleItemChange}
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                                <h5 className="text-lg font-semibold text-gray-800 m-0">
                                    Raw Material Details
                                </h5>
                                <CustomButton
                                    text="Add Row"
                                    icon={FaPlus}
                                    type="button"
                                    onClick={addRow}
                                />
                            </div>

                            <div className="space-y-4">
                                {formData.items.map((item, index) => {
                                    const selectedRawMaterialIds = formData.items.map(i => i.rawMaterialId).filter(Boolean);
                                    return (
                                        <div key={index} className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex-1 min-w-[200px]">
                                                <SelectInput
                                                    label="RAW MATERIAL"
                                                    name="rawMaterialId"
                                                    value={item.rawMaterialId}
                                                    error={errors[`items.${index}.rawMaterialId`]}
                                                    required
                                                    options={[
                                                        { value: "", label: "Select Raw Material" },
                                                        ...rawMaterials.map(rm => ({
                                                            value: rm.rawMaterialId,
                                                            label: `${rm.materialName} (${rm.rawMaterialId})`,
                                                            disabled: selectedRawMaterialIds.includes(rm.rawMaterialId) && item.rawMaterialId !== rm.rawMaterialId
                                                        }))
                                                    ]}
                                                    onChange={(e) => handleRowChange(index, "rawMaterialId", e.target.value)}
                                                />
                                            </div>
                                            <div className="w-full sm:w-[150px]">
                                                <TextInput
                                                    label="REQUIRED QUANTITY"
                                                    name="requiredQuantity"
                                                    type="number"
                                                    value={item.requiredQuantity}
                                                    error={errors[`items.${index}.requiredQuantity`]}
                                                    placeholder="Enter Quantity"
                                                    required
                                                    onChange={(e) => handleRowChange(index, "requiredQuantity", e.target.value)}
                                                />
                                            </div>
                                            <div className="w-full sm:w-[150px]">
                                                <SelectInput
                                                    label="UOM"
                                                    name="uom"
                                                    value={item.uom}
                                                    error={errors[`items.${index}.uom`]}
                                                    required
                                                    options={[
                                                        { value: "", label: "Select UOM" },
                                                        ...uoms.map(u => ({
                                                            value: u.code,
                                                            label: u.name
                                                        }))
                                                    ]}
                                                    onChange={(e) => handleRowChange(index, "uom", e.target.value)}
                                                />
                                            </div>
                                            <div className="w-full sm:w-auto flex justify-center pb-1">
                                                <DeleteButton onClick={() => removeRow(index)} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                            <Button
                                text={isLoading ? "Updating..." : "Update Bill Of Material"}
                                icon={FaSave}
                                type="submit"
                                disabled={isLoading}
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BillOfMaterialEdit;