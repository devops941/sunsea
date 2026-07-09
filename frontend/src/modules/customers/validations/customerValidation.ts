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

    if (
        !formData.customerType ||
        (Array.isArray(formData.customerType) && formData.customerType.length === 0) ||
        (typeof formData.customerType === "string" && !formData.customerType.trim())
    ) {
        newErrors.customerType = "Customer Type is required";
    }

    if (!formData.contactPerson.trim()) {
        newErrors.contactPerson = "Contact Person is required";
    } else if (!/^[a-zA-Z.\s]+$/.test(formData.contactPerson)) {
        newErrors.contactPerson = "Contact Person should only contain letters";
    }

    if (formData.designation && !/^[a-zA-Z.\s]+$/.test(formData.designation)) {
        newErrors.designation = "Designation should only contain letters";
    }

    const mobileError = validatePhoneNumber(formData.mobile, true);
    if (mobileError) {
        newErrors.mobile = mobileError;
    }

    const altPhoneError = validatePhoneNumber(formData.altPhone, true);
    if (altPhoneError) {
        newErrors.altPhone = altPhoneError;
    }

    const whatsappError = validatePhoneNumber(formData.whatsapp, false);
    if (whatsappError) {
        newErrors.whatsapp = whatsappError;
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

    if (
        formData.pan &&
        !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)
    ) {
        newErrors.pan = "Invalid PAN (auto-derived from GSTIN)";
    }

    if (!formData.gstRegType) {
        newErrors.gstRegType = "GST Registration Type is required";
    }

    // GSTIN is mandatory if registration type is Regular/Composition/SEZ
    if (
        ["Regular", "Composition", "SEZ"].includes(formData.gstRegType) &&
        !formData.gstin.trim()
    ) {
        newErrors.gstin = "GSTIN is required for this registration type";
    }

    // if (!formData.stateCode.trim()) {
    //     newErrors.stateCode = "State Code is required";
    // } else if (!/^[0-9]{2}$/.test(formData.stateCode)) {
    //     newErrors.stateCode = "State Code must be a 2-digit number";
    // }

    if (formData.tcsRate !== "" && formData.tcsRate !== null) {
        const tcs = Number(formData.tcsRate);
        if (isNaN(tcs) || tcs < 0 || tcs > 100) {
            newErrors.tcsRate = "TCS Rate must be between 0 and 100";
        }
    }

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

    // ---- Shipping Address ----
    if (!formData.sameAsBilling) {
        if (!formData.shippingAddressLine1 || !formData.shippingAddressLine1.trim()) {
            newErrors.shippingAddressLine1 = "Shipping Address is required";
        }

        if (!formData.shippingCity || !formData.shippingCity.trim()) {
            newErrors.shippingCity = "City is required";
        }

        if (!formData.shippingState || !formData.shippingState.trim()) {
            newErrors.shippingState = "State is required";
        }

        if (!formData.shippingPincode || !formData.shippingPincode.trim()) {
            newErrors.shippingPincode = "Pincode is required";
        } else if (!/^[1-9][0-9]{5}$/.test(formData.shippingPincode)) {
            newErrors.shippingPincode = "Enter a valid 6-digit pincode";
        }
    }

    // ---- Commercial Settings ----
    if (formData.creditLimit === "" || formData.creditLimit === null) {
        newErrors.creditLimit = "Credit Limit is required";
    } else if (isNaN(Number(formData.creditLimit)) || Number(formData.creditLimit) < 0) {
        newErrors.creditLimit = "Credit Limit must be a valid non-negative number";
    }

    if (formData.creditDays === "" || isNaN(Number(formData.creditDays))) {
        newErrors.creditDays = "Credit Days must be a valid number";
    }

    if (!formData.priceList) {
        newErrors.priceList = "Price List is required";
    }

    // ---- Bank Accounts ----
    if (formData.bankAccounts && Array.isArray(formData.bankAccounts)) {
        formData.bankAccounts.forEach((bank: any, index: number) => {
            if (!bank.bankHolderName?.trim()) {
                newErrors[`bankAccounts.${index}.bankHolderName`] = "Account Holder Name is required";
            }
            if (!bank.bankName?.trim()) {
                newErrors[`bankAccounts.${index}.bankName`] = "Bank Name is required";
            }
            if (!bank.ifscCode?.trim()) {
                newErrors[`bankAccounts.${index}.ifscCode`] = "IFSC Code is required";
            } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifscCode)) {
                newErrors[`bankAccounts.${index}.ifscCode`] = "Invalid IFSC code";
            }
            if (!bank.accountNumber?.trim()) {
                newErrors[`bankAccounts.${index}.accountNumber`] = "Account Number is required";
            } else if (!/^[0-9]{9,18}$/.test(bank.accountNumber)) {
                newErrors[`bankAccounts.${index}.accountNumber`] = "Account Number must be 9-18 digits";
            }
            if (!bank.branchName?.trim()) {
                newErrors[`bankAccounts.${index}.branchName`] = "Branch is required";
            }
            const upiMobileNumberError = validatePhoneNumber(bank.upiMobileNumber, false);
            if (upiMobileNumberError) {
                newErrors[`bankAccounts.${index}.upiMobileNumber`] = upiMobileNumberError;
            }
        });
    }

    return newErrors;
}