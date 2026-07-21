import React, { useState } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import TextInput from "../../form/TextInput/TextInput";


export interface ProductionWorkflowInputProps {
    /** Ordered list of step names. Empty = no workflow. */
    value: string[];
    /** Called with the updated ordered list whenever steps are added/removed. */
    onChange: (steps: string[]) => void;
    /** Optional error message to show below the list (e.g. duplicate step). */
    error?: string;
    /** Optional heading override. */
    label?: string;
    /** Optional helper text override. */
    helperText?: string;
}

/**
 * Reusable, free-text, step-by-step workflow builder.
 *
 * Fully controlled: the parent owns `value` (an ordered string[]) and
 * receives updates via `onChange`. No hardcoded stages — the user types
 * whatever step names they want (e.g. Production, Handle Change,
 * Stickering & Package, Dispatch, or anything custom), and the order they
 * add them in is the order the item moves through the pipeline.
 *
 * Usage:
 *   const [steps, setSteps] = useState<string[]>([]);
 *   <ProductionWorkflowInput value={steps} onChange={setSteps} error={errors.productionSteps} />
 */
const FlowInput: React.FC<ProductionWorkflowInputProps> = ({
    value,
    onChange,
    error,
    label = "Production Workflow",

}) => {
    const [stepInput, setStepInput] = useState("");

    const handleAddStep = () => {
        const trimmed = stepInput.trim();
        if (!trimmed) {
            toast.error("Type a step name first");
            return;
        }
        const alreadyExists = value.some(
            s => s.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (alreadyExists) {
            toast.error("That step has already been added");
            return;
        }
        onChange([...value, trimmed]);
        setStepInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddStep();
        }
    };

    const handleRemoveStep = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    return (
        <div>
            <h6 className="text-base font-semibold text-gray-800 mb-1">{label}</h6>


            {/* Text box + Add button */}
            <div className="flex items-start gap-2 mb-3">
                <div className="flex-1">
                    <TextInput
                        label=""
                        name="productionWorkflowStepInput"
                        value={stepInput}
                        placeholder="e.g. Production"
                        onChange={(e) => setStepInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2.5 rounded-lg font-medium transition-colors border border-indigo-100 flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                    <FaPlus size={10} /> Add Step
                </button>
            </div>

            {value.length > 0 ? (
                <div className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex flex-col gap-2">
                        {value.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                                    {idx + 1}
                                </span>
                                <span className="flex-1 text-sm text-gray-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    {step}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveStep(idx)}
                                    className="text-red-500 hover:text-red-700 p-2 shrink-0"
                                    title="Remove step"
                                >
                                    <FaTimes size={14} />
                                </button>

                            </div>
                        ))}
                    </div>
                    {error && (
                        <div className="mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <></>
            )}
        </div>
    );
};

export default FlowInput;