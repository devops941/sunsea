// validations/customerValidation.ts
import { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";



export const validateCustomer = (
    formData: any,
) => {
    const newErrors: Record<string, string> = {};

    // ---- Customer Info ----
    if (!formData.customerId.trim()) {
        newErrors.customerId = "Customer Code is required";
    }

    if (!formData.isActive) {
        newErrors.isActive = "Status is required";
    }

    // ---- Basic Information ----
    if (!formData.firmName.trim()) {
        newErrors.firmName = "Firm Name is required";
    } else if (formData.firmName.trim().length < 3) {
        newErrors.firmName = "Firm Name must be at least 3 characters";
    }

    if (formData.displayName && formData.displayName.trim().length < 2) {
        newErrors.displayName = "Display Name must be at least 2 characters";
    }

    const primaryMobileNumber = Array.isArray(formData.mobile) && formData.mobile.length > 0 ? formData.mobile[0].number : (typeof formData.mobile === "string" ? formData.mobile : "");
    const mobileError = validatePhoneNumber(primaryMobileNumber, true);
    if (mobileError) {
        newErrors.mobile = mobileError;
    }

    const email = formData.email?.trim();

    if (!email) {
        newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = "Invalid email address";
    }

    // ---- GST & Statutory ----
    if (
        formData.gstin &&
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/.test(
            formData.gstin
        )
    ) {
        newErrors.gstin = "Invalid GSTIN format";
    }

    // if (
    //     formData.pan &&
    //     !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)
    // ) {
    //     newErrors.pan = "Invalid PAN (auto-derived from GSTIN)";
    // }

    // if (!formData.gstRegType) {
    //     newErrors.gstRegType = "GST Registration Type is required";
    // }

    // GSTIN is mandatory if registration type is Regular/Composition/SEZ
    // if (
    //     ["Regular", "Composition", "SEZ"].includes(formData.gstRegType) &&
    //     !formData.gstin.trim()
    // ) {
    //     newErrors.gstin = "GSTIN is required for this registration type";
    // }

    if (!formData.stateCode.trim()) {
        newErrors.stateCode = "State Code is required";
    } else if (!/^[0-9]{2}$/.test(formData.stateCode)) {
        newErrors.stateCode = "State Code must be a 2-digit number";
    }

    // if (formData.tcsRate !== "" && formData.tcsRate !== null) {
    //     const tcs = Number(formData.tcsRate);
    //     if (isNaN(tcs) || tcs < 0 || tcs > 100) {
    //         newErrors.tcsRate = "TCS Rate must be between 0 and 100";
    //     }
    // }

    // ---- Billing Address ----
    if (!formData.billingAddressLine1.trim()) {
        newErrors.billingAddressLine1 = "Billing Address is required";
    }

    if (!formData.billingCity || !formData.billingCity.trim()) {
        newErrors.billingCity = "City is required";
    }

    if (!formData.billingState || !formData.billingState.trim()) {
        newErrors.billingState = "State is required";
    }

    if (!formData.billingPincode || !formData.billingPincode.trim()) {
        newErrors.billingPincode = "Pincode is required";
    } else if (!/^[1-9][0-9]{5}$/.test(formData.billingPincode)) {
        newErrors.billingPincode = "Enter a valid 6-digit pincode";
    }

    // ---- Additional Addresses ----
    if (formData.addresses && Array.isArray(formData.addresses)) {
        formData.addresses.forEach((addr: any, index: number) => {
            const address = addr.address;
            if (!address.addressLine1?.trim()) {
                newErrors[`addresses.${index}.address.addressLine1`] = "Address Line 1 is required";
            }
            if (!address.state?.trim()) {
                newErrors[`addresses.${index}.address.state`] = "State is required";
            }
            if (!address.city?.trim()) {
                newErrors[`addresses.${index}.address.city`] = "City is required";
            }
            if (!address.pincode?.trim()) {
                newErrors[`addresses.${index}.address.pincode`] = "Pincode is required";
            } else if (!/^[1-9][0-9]{5}$/.test(address.pincode)) {
                newErrors[`addresses.${index}.address.pincode`] = "Enter a valid 6-digit pincode";
            }
        });
    }

    // ---- Commercial Settings ----
    if (formData.creditLimit === "" || formData.creditLimit === null) {
        newErrors.creditLimit = "Credit Limit is required";
    } else if (isNaN(Number(formData.creditLimit)) || Number(formData.creditLimit) < 0) {
        newErrors.creditLimit = "Credit Limit must be a valid non-negative number";
    } else if (Number(formData.creditLimit) < 25000) {
        newErrors.creditLimit = "Credit Limit must be at least ₹25000";
    }

    if (!formData.priceList) {
        newErrors.priceList = "Price List is required";
    }

    return newErrors;
}