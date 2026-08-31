import React, { useState, useEffect, useCallback } from "react";
import { FaSave, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createStore, updateStore } from "../../../features/stores/storeSlice";
import { fetchEmployees } from "../../../features/employee/employeeSlice";
import { storeService } from "../../../services/storeService";
import { storeTypeService } from "../../../services/storeTypeService";
import { STORE_CATEGORY_OPTIONS } from "../../../features/stores/types";
import { useRoles } from "../../../hooks/useRoles";

import Button from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";

const initialFormState = {
    storeId: "",
    storeName: "",
    storeCategory: "",
    inchargeId: "",
    addressLine: "",
    city: "",
    state: "",
    country: "India",
    zipcode: "",
    locationDesc: "",
    gstPlace: "",
    isActive: true,
};

const storeSchema = z.object({
    storeName: z
        .string()
        .trim()
        .min(1, "Store Name is required")
        .max(100, "Maximum 100 characters allowed")
        .regex(
            /^[A-Za-z0-9\s&()-]+$/,
            "Store Name can only contain letters, numbers, spaces, &, (, ), and -"
        ),

    storeCategory: z
        .string()
        .trim()
        .min(1, "Store Category is required"),

    inchargeId: z
        .string()
        .trim()
        .min(1, "Store Incharge is required"),

    locationDesc: z
        .string()
        .trim()
        .max(255, "Location address cannot exceed 255 characters")
        .optional()
        .or(z.literal("")),

    gstPlace: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
});

const StorageStoreForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const dispatch = useAppDispatch();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState("");
    const [dbStoreTypes, setDbStoreTypes] = useState<Array<{ label: string; value: string }>>([]);

    const { employees } = useAppSelector((state: any) => state.employees || { employees: [] });
    const { roles, loadRoles } = useRoles();

    // Fetch database dependencies
    const fetchDependencies = useCallback(async () => {
        dispatch(fetchEmployees(undefined));
        loadRoles();
        try {
            const res = await storeTypeService.fetchAll();
            const types = Array.isArray(res) ? res : res?.storeTypes || [];
            const mapped = types.map((st: any) => ({
                label: st.name || st.code,
                value: st.code || st.name
            }));
            setDbStoreTypes(mapped);
        } catch {
            // store types are optional; continue without them
        }
    }, [dispatch, loadRoles]);

    // Load initial data (Create mode vs Edit mode)
    useEffect(() => {
        let isMounted = true;
        const initializeForm = async () => {
            setPageLoading(true);
            await fetchDependencies();

            if (isEditMode && id) {
                try {
                    const storeData = await storeService.fetchById(id);
                    if (isMounted && storeData) {
                        let addressLine = "";
                        let city = "";
                        let state = "";
                        let country = "India";
                        let zipcode = "";

                        if (storeData.locationDesc) {
                            try {
                                const parsed = JSON.parse(storeData.locationDesc);
                                if (typeof parsed === "object" && parsed !== null) {
                                    addressLine = parsed.addressLine || "";
                                    city = parsed.city || "";
                                    state = parsed.state || "";
                                    country = parsed.country || "India";
                                    zipcode = parsed.zipcode || "";
                                } else {
                                    addressLine = storeData.locationDesc;
                                }
                            } catch {
                                addressLine = storeData.locationDesc;
                            }
                        }

                        setFormData({
                            storeId: storeData.storeId,
                            storeName: storeData.storeName || "",
                            storeCategory: storeData.storeCategory || "",
                            inchargeId: storeData.inchargeId ? storeData.inchargeId.toString() : "",
                            addressLine,
                            city,
                            state,
                            country,
                            zipcode,
                            locationDesc: storeData.locationDesc || "",
                            gstPlace: storeData.gstPlace || "",
                            isActive: storeData.isActive ?? true,
                        });
                    }
                } catch (err: any) {
                    toast.error(err?.message || "Failed to load store details");
                    navigate("/storage-stores");
                }
            } else {
                let nextId = "";
                try {
                    nextId = await storeService.fetchNextId();
                } catch {
                    nextId = `STR${Math.floor(100 + Math.random() * 900)}`;
                }
                if (isMounted) {
                    setFormData({ ...initialFormState, storeId: nextId });
                }
            }
            if (isMounted) setPageLoading(false);
        };

        initializeForm();
        return () => { isMounted = false; };
    }, [id, isEditMode, fetchDependencies, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const { name, value } = target;
        const type = (target as any).type;

        const checked =
            type === "checkbox"
                ? (target as HTMLInputElement).checked
                : undefined;

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            storeSchema.parse(formData);
            setErrors({});
        } catch (error) {
            if (error instanceof z.ZodError) {
                const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
                const formattedErrors: Record<string, string> = {};
                Object.keys(fieldErrors).forEach((key) => {
                    const message = fieldErrors[key]?.[0];
                    if (message) formattedErrors[key] = message;
                });
                setErrors(formattedErrors);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const fullAddressString = [
                formData.addressLine,
                formData.city,
                formData.state,
                formData.country,
                formData.zipcode ? `Pincode: ${formData.zipcode}` : ""
            ].filter(Boolean).join(", ");

            const structuredLocationDesc = JSON.stringify({
                addressLine: formData.addressLine || "",
                city: formData.city || "",
                state: formData.state || "",
                country: formData.country || "India",
                zipcode: formData.zipcode || "",
                formatted: fullAddressString
            });

            const payload = {
                storeId: formData.storeId,
                storeName: formData.storeName,
                storeCategory: formData.storeCategory || undefined,
                inchargeId: formData.inchargeId || undefined,
                locationDesc: fullAddressString ? structuredLocationDesc : undefined,
                gstPlace: formData.gstPlace || undefined,
                isActive: formData.isActive
            };

            if (isEditMode) {
                await dispatch(updateStore({ id: formData.storeId, data: payload as any })).unwrap();
                toast.success("Store updated successfully!");
            } else {
                await dispatch(createStore(payload as any)).unwrap();
                toast.success("Store created successfully!");
            }
            navigate("/storage-stores");
        } catch (err: any) {
            const errorMessage = typeof err === 'string' ? err : err?.message || "Failed to save store";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const categoryOptions = [
        { label: "Select a category", value: "" },
        ...STORE_CATEGORY_OPTIONS,
        ...dbStoreTypes.filter(st => !STORE_CATEGORY_OPTIONS.some(o => o.value === st.value))
    ];

    if (pageLoading) {
        return <CommonLoader text={isEditMode ? "Loading Store Details..." : "Initializing Store Form..."} fullScreen={false} />;
    }

    return (
        <div className="w-full max-w-[1024px] xl:mr-auto flex-1 flex flex-col">
            <div className="bg-card rounded-xl shadow-xs border border-line-soft overflow-visible flex-1 flex flex-col">
                {/* Page Header */}
                <div className="px-6 py-5 border-b border-line-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-ink">
                                {isEditMode ? "Edit Storage Store" : "Create Storage Store"}
                            </h2>
                            <p className="text-sm text-ink-subtle mt-1">
                                {isEditMode ? `Editing details for Store ID: ${formData.storeId}` : "Enter details to create a new storage store location."}
                            </p>
                        </div>
                        <BackButton to="/storage-stores" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-8 flex-1 flex flex-col" noValidate>
                    {/* Section 1: Basic Information */}
                    <div>
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-line-soft">
                            <h3 className="text-lg font-bold text-ink">Basic Store Details</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <TextInput
                                label="Store ID"
                                name="storeId"
                                value={formData.storeId}
                                placeholder="e.g. STR001"
                                required
                                disabled={true}
                                onChange={handleChange}
                            />

                            <TextInput
                                label="Store Name"
                                name="storeName"
                                value={formData.storeName}
                                placeholder="e.g. Main Warehouse"
                                required
                                error={errors.storeName}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Store Category"
                                name="storeCategory"
                                value={formData.storeCategory}
                                options={categoryOptions}
                                required
                                error={errors.storeCategory}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Filter Incharge by Role"
                                name="selectedRoleId"
                                value={selectedRoleId}
                                options={[
                                    { label: "Select a role", value: "" },
                                    ...(roles || []).map(r => ({ label: r.name, value: String(r.id) }))
                                ]}
                                onChange={(e) => {
                                    setSelectedRoleId(e.target.value);
                                    setFormData(prev => ({ ...prev, inchargeId: "" }));
                                }}
                            />

                            <SelectInput
                                label="Store Incharge"
                                name="inchargeId"
                                value={formData.inchargeId}
                                options={[
                                    { label: "Select an incharge", value: "" },
                                    ...(employees || [])
                                        .filter((emp: any) => !selectedRoleId || String(emp.roleId || emp.user?.roleId) === selectedRoleId)
                                        .map((emp: any) => ({
                                            label: `${emp.fullName} (${emp.empCode})`,
                                            value: emp.id?.toString() || ""
                                        }))
                                ]}
                                required
                                error={errors.inchargeId}
                                onChange={handleChange}
                            />

                            <SelectInput
                                label="Status"
                                name="isActive"
                                value={formData.isActive.toString()}
                                options={[
                                    { label: "Active", value: "true" },
                                    { label: "Inactive", value: "false" }
                                ]}
                                required
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === "true" }))}
                            />
                        </div>
                    </div>

                    {/* Section 2: Location & Address Information */}
                    <div>
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-line-soft">
                            <h3 className="text-lg font-bold text-ink">Location & Address Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2 lg:col-span-3">
                                <TextInput
                                    label="Street Address / Building"
                                    name="addressLine"
                                    value={formData.addressLine}
                                    placeholder="e.g. Door No. 12, Industrial Estate, Main Road"
                                    onChange={handleChange}
                                />
                            </div>

                            <CityStateSelect
                                countryLabel="Country"
                                countryValue={formData.country || "India"}
                                onCountryChange={(cData) => setFormData(prev => ({ ...prev, country: cData.name || "India" }))}
                                stateLabel="State"
                                stateValue={formData.state || ""}
                                onStateChange={(sData) => setFormData(prev => ({ ...prev, state: sData.name || "", city: "" }))}
                                cityLabel="City"
                                cityValue={formData.city || ""}
                                onCityChange={(cData) => setFormData(prev => ({ ...prev, city: cData.name || "" }))}
                            />

                            <div>
                                <TextInput
                                    label="Zipcode / Pincode"
                                    name="zipcode"
                                    value={formData.zipcode}
                                    placeholder="e.g. 600001"
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Form Footer Action Buttons */}
                    <div className="flex flex-wrap justify-end gap-3 mt-auto pt-4 border-t border-line-soft">
                        <Button
                            text="Cancel"
                            icon={FaArrowLeft}
                            variant="secondary"
                            onClick={() => navigate("/storage-stores")}
                            disabled={isSubmitting}
                        />
                        <Button
                            type="submit"
                            text={isEditMode ? "Update Store" : "Save Store"}
                            icon={FaSave}
                            variant="primary"
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StorageStoreForm;
