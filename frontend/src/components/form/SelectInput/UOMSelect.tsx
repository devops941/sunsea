import React from "react";
import { Form, Spinner, Button } from "react-bootstrap";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import Select, { components } from "react-select";
import type { MultiValueProps } from "react-select";
import { useUOM } from "../../../hooks/useUOM";

const SortableMultiValue = (props: MultiValueProps<any>) => {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", props.index.toString());
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const draggedIndexStr = e.dataTransfer.getData("text/plain");
    if (!draggedIndexStr) return;
    const draggedIndex = parseInt(draggedIndexStr, 10);
    const targetIndex = props.index;

    if (draggedIndex !== targetIndex) {
      const onReorder = (props.selectProps as any).onReorder;
      if (onReorder) {
        onReorder(draggedIndex, targetIndex);
      }
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor: "grab", display: "inline-flex" }}
    >
      <components.MultiValue {...props} />
    </div>
  );
};

interface UOMSelectProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  category?: string | string[];
  allowedCodes?: string[];
  control?: Control<any>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  isMulti?: boolean;
}

export const UOMSelect: React.FC<UOMSelectProps> = ({
  name,
  label,
  placeholder = "Select Unit of Measure",
  required = false,
  disabled = false,
  category,
  allowedCodes,
  control,
  value,
  defaultValue = "",
  onChange: customOnChange,
  error,
  isMulti = false,
}) => {
  const { units, loading, error: fetchError, retry } = useUOM();

  // Filter units dynamically by category/categories and allowedCodes if provided
  // Categories available: "length", "area", "mass", "volume", "time"
  // Example Units:
  // - mass: kg, g, ton, t
  // - volume/liquid: l, ml, ltr
  // - length: m, cm, mm, in, ft
  // - area: sq_m, sq_ft, ac, ha
  // - time: s, min, h, d

  
  const filteredUnits = React.useMemo(() => {
    let result = units;

    // Log the incoming units to the console so you can see all available values
    if (units.length > 0) {
      console.log("Fetched UOM Units: ", units);
    }

    if (category) {
      const categoriesArray = Array.isArray(category)
        ? category.map((c) => c.toLowerCase())
        : [category.toLowerCase()];
      result = result.filter((u) => categoriesArray.includes(u.category.toLowerCase()));
    }

    if (allowedCodes && allowedCodes.length > 0) {
      const allowed = allowedCodes.map((c) => c.toLowerCase());
      result = result.filter((u) => allowed.includes(u.code.toLowerCase()));
    }

    return result;
  }, [units, category, allowedCodes]);

  return (
    <Form.Group className="select-input-group">
      <Form.Label className="select-input-label">
        <span>{label}</span>
        {required && <span className="required-star">*</span>}
      </Form.Label>
      
      {loading ? (
        <div className="d-flex align-items-center gap-2 py-1">
          <Spinner animation="border" size="sm" variant="primary" />
          <span className="text-muted small">Loading units...</span>
        </div>
      ) : fetchError ? (
        <div className="d-flex align-items-center gap-2 border border-danger rounded p-2 bg-light">
          <span className="text-danger small">{fetchError}</span>
          <Button variant="outline-danger" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : control ? (
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue}
          rules={{ required: required ? `${label} is required` : false }}
          render={({ field, fieldState }) => {
            if (isMulti) {
              const currentValueArray = field.value ? field.value.split(",").map((v: string) => v.trim()).filter(Boolean) : [];
              const firstSelectedCode = currentValueArray.length > 0 ? currentValueArray[0] : null;
              const lockedCategory = firstSelectedCode 
                ? filteredUnits.find((u) => u.code === firstSelectedCode)?.category 
                : null;

              const options = filteredUnits
                .filter((u) => !lockedCategory || u.category === lockedCategory)
                .map((u) => ({
                  label: `${u.label} (${u.code})`,
                  value: u.code,
                }));
              const selectedOptions = currentValueArray
                .map((val: string) => options.find((o) => o.value === val))
                .filter(Boolean);

              return (
                <>
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    isDisabled={disabled}
                    options={options}
                    value={selectedOptions}
                    placeholder={placeholder}
                    components={{ MultiValue: SortableMultiValue }}
                    {...({
                      onReorder: (dragIndex: number, hoverIndex: number) => {
                        const newValues = [...currentValueArray];
                        const [dragged] = newValues.splice(dragIndex, 1);
                        newValues.splice(hoverIndex, 0, dragged);
                        const newValueStr = newValues.join(",");
                        field.onChange(newValueStr);
                        if (customOnChange) customOnChange(newValueStr);
                      }
                    } as any)}
                    className={fieldState.error ? 'is-invalid' : ''}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderColor: fieldState.error ? '#dc3545' : base.borderColor,
                      }),
                    }}
                    onChange={(selected: any) => {
                      const newValue = selected ? selected.map((s: any) => s.value).join(",") : "";
                      field.onChange(newValue);
                      if (customOnChange) {
                        customOnChange(newValue);
                      }
                    }}
                  />
                  {fieldState.error && (
                    <span className="text-danger small mt-1 d-block" style={{ fontSize: "0.875rem" }}>
                      {fieldState.error.message}
                    </span>
                  )}
                </>
              );
            }
            return (
              <>
                <Form.Select
                  {...field}
                  disabled={disabled}
                  className={`select-input-control ${fieldState.error ? 'is-invalid border-danger' : ''}`}
                  onChange={(e) => {
                    field.onChange(e);
                    if (customOnChange) {
                      customOnChange(e.target.value);
                    }
                  }}
                >
                  <option value="">{placeholder}</option>
                  {filteredUnits && filteredUnits.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.label} ({u.code})
                    </option>
                  ))}
                </Form.Select>
                {fieldState.error && (
                  <span className="text-danger small mt-1 d-block" style={{ fontSize: "0.875rem" }}>
                    {fieldState.error.message}
                  </span>
                )}
              </>
            );
          }}
        />
      ) : (
        <>
          {isMulti ? (
            (() => {
              const currentValueArray = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
              const firstSelectedCode = currentValueArray.length > 0 ? currentValueArray[0] : null;
              const lockedCategory = firstSelectedCode 
                ? filteredUnits.find((u) => u.code === firstSelectedCode)?.category 
                : null;

              const options = filteredUnits
                .filter((u) => !lockedCategory || u.category === lockedCategory)
                .map((u) => ({
                  label: `${u.label} (${u.code})`,
                  value: u.code,
                }));
              const selectedOptions = currentValueArray
                .map((val) => options.find((o) => o.value === val))
                .filter(Boolean);

              return (
                <Select
                  isMulti
                  closeMenuOnSelect={false}
                  isDisabled={disabled}
                  options={options}
                  value={selectedOptions}
                  placeholder={placeholder}
                  components={{ MultiValue: SortableMultiValue }}
                  {...({
                    onReorder: (dragIndex: number, hoverIndex: number) => {
                      const newValues = [...currentValueArray];
                      const [dragged] = newValues.splice(dragIndex, 1);
                      newValues.splice(hoverIndex, 0, dragged);
                      const newValueStr = newValues.join(",");
                      if (customOnChange) customOnChange(newValueStr);
                    }
                  } as any)}
                  className={error ? 'is-invalid' : ''}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: error ? '#dc3545' : base.borderColor,
                    }),
                  }}
                  onChange={(selected: any) => {
                    if (customOnChange) {
                      const newValue = selected ? selected.map((s: any) => s.value).join(",") : "";
                      customOnChange(newValue);
                    }
                  }}
                />
              );
            })()
          ) : (
            <Form.Select
              name={name}
              disabled={disabled}
              value={value}
              className={`select-input-control ${error ? 'is-invalid border-danger' : ''}`}
              onChange={(e) => {
                if (customOnChange) {
                  customOnChange(e.target.value);
                }
              }}
            >
              <option value="">{placeholder}</option>
              {filteredUnits && filteredUnits.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.label} ({u.code})
                </option>
              ))}
            </Form.Select>
          )}
          {error && (
            <span className="text-danger small mt-1 d-block" style={{ fontSize: "0.875rem" }}>
              {error}
            </span>
          )}
        </>
      )}
    </Form.Group>
  );
};

export default UOMSelect;
