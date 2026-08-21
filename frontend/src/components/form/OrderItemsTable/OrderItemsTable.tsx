import React, { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import type { FieldErrors, UseFieldArrayRemove } from "react-hook-form";
import SelectInput from "../SelectInput/SelectInput";
import TextInput from "../TextInput/TextInput";
import DeleteButton from "../../ui/DeleteButton/DeleteButton";

export interface OrderItemsTableProps {
    control: any;
    fields: any[];
    errors: FieldErrors<any>;
    productOptions: { value: string; label: string }[];
    products?: any[];
    remove: UseFieldArrayRemove;
    editable?: boolean;
}

const RowItem: React.FC<{
    control: any;
    index: number;
    field: any;
    errors: any;
    productOptions: { value: string; label: string }[];
    productsMap: Map<string, any>;
    editable: boolean;
    remove: UseFieldArrayRemove;
    canRemove: boolean;
}> = ({ control, index, field, errors, productOptions, productsMap, editable, remove, canRemove }) => {
    const itemValue = useWatch({ control, name: `items.${index}` });
    const selectedProd = itemValue?.productCode ? productsMap.get(String(itemValue.productCode)) : null;
    const unitRate = selectedProd ? (selectedProd.rate != null ? Number(selectedProd.rate) : (selectedProd.mrp != null ? Number(selectedProd.mrp) : 0)) : 0;
    const qty = Number(itemValue?.quantity) || 0;
    const lineTotal = unitRate * qty;

    return (
        <tr key={field.id} className="hover:bg-card-2/50 transition-colors duration-200">
            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-ink-subtle text-center">{index + 1}</td>

            <td className="px-3 py-2 whitespace-nowrap">
                <Controller
                    name={`items.${index}.productCode`}
                    control={control}
                    render={({ field: f }) => (
                        <SelectInput
                            noMargin={true}
                            label=""
                            name={f.name}
                            value={String(f.value || "")}
                            options={productOptions}
                            onChange={f.onChange}
                            defaultOptionLabel="Select Product"
                            error={(errors.items as any)?.[index]?.productCode?.message as string}
                            disabled={!editable}
                            hideLabel
                        />
                    )}
                />
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-sm text-ink font-medium">
                {selectedProd ? `₹${unitRate.toFixed(2)}` : "-"}
            </td>

            <td className="px-3 py-2 whitespace-nowrap">
                <Controller
                    name={`items.${index}.quantity`}
                    control={control}
                    render={({ field: f }) => (
                        <TextInput
                            name={f.name}
                            value={String(f.value || "")}
                            onChange={f.onChange}
                            onBlur={f.onBlur}
                            type="number"
                            placeholder="0"
                            error={(errors.items as any)?.[index]?.quantity?.message as string}
                            disabled={!editable}
                        />
                    )}
                />
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-ink">
                {selectedProd ? `₹${lineTotal.toFixed(2)}` : "-"}
            </td>

            {editable && (
                <td className="px-3 py-2 whitespace-nowrap text-center flex justify-center">
                    <DeleteButton
                        onClick={() => remove(index)}
                        disabled={!canRemove}
                        disabledMessage="At least one component product is required."
                    />
                </td>
            )}
        </tr>
    );
};

const OrderItemsTable: React.FC<OrderItemsTableProps> = ({
    control,
    fields,
    errors,
    productOptions,
    products = [],
    remove,
    editable = true,
}) => {
    const productsMap = useMemo(() => {
        const map = new Map<string, any>();
        products.forEach((p) => map.set(String(p.id), p));
        return map;
    }, [products]);

    return (
        <div className="rounded-xl border border-line bg-card [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
                <thead className="bg-card-2">
                    <tr>
                        <th className="px-3 py-3 text-center text-[11px] font-bold text-ink-muted uppercase tracking-widest w-12 border-b border-line">#</th>
                        <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest border-b border-line">Product</th>
                        <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest w-32 border-b border-line">Unit Rate (₹)</th>
                        <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest w-32 border-b border-line">Quantity</th>
                        <th className="px-3 py-3 text-left text-[11px] font-bold text-ink-muted uppercase tracking-widest w-32 border-b border-line">Amount (₹)</th>
                        {editable && (
                            <th className="px-3 py-3 text-center text-[11px] font-bold text-ink-muted uppercase tracking-widest w-16 border-b border-line"></th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-line">
                    {fields.map((field, index) => (
                        <RowItem
                            key={field.id}
                            control={control}
                            index={index}
                            field={field}
                            errors={errors}
                            productOptions={productOptions}
                            productsMap={productsMap}
                            editable={editable}
                            remove={remove}
                            canRemove={fields.length > 1}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default OrderItemsTable;
