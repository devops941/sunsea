import React from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldErrors, UseFieldArrayRemove } from "react-hook-form";
import { FaTrash } from "react-icons/fa";
import SelectInput from "../SelectInput/SelectInput";
import TextInput from "../TextInput/TextInput";

export interface OrderItemsTableProps {
    control: any;
    fields: any[];
    errors: FieldErrors<any>;
    productOptions: { value: string; label: string }[];

    remove: UseFieldArrayRemove;
    editable?: boolean;
}

const OrderItemsTable: React.FC<OrderItemsTableProps> = ({
    control,
    fields,
    errors,
    productOptions,

    remove,
    editable = true,
}) => {
    return (
        <div className="rounded-xl border border-slate-200 bg-white [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                    <tr>
                        <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-12 border-b border-slate-200">#</th>
                        <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Product</th>

                        <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest w-48 border-b border-slate-200">Quantity</th>
                        {editable && (
                            <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-16 border-b border-slate-200"></th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {fields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-slate-50/50 transition-colors duration-200 ">
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-400 text-center">{index + 1}</td>

                            <td className="px-3 py-2 whitespace-nowrap">
                                <Controller
                                    name={`items.${index}.productCode`}
                                    control={control}
                                    render={({ field: f }) => (
                                        <SelectInput noMargin={true}
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

                            {editable && (
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                    <button
                                        type="button"
                                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-100 p-2 rounded-md disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center justify-center"
                                        onClick={() => remove(index)}
                                        disabled={fields.length === 1}
                                        title="Remove item"
                                    >
                                        <FaTrash size={14} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default OrderItemsTable;
