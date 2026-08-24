export const PAYMENT_TERM_OPTIONS = [
    { label: "Select Payment Term", value: "" },
    { label: "Net 30", value: "net_30" },
    { label: "Net 15", value: "net_15" },
    { label: "Advance", value: "advance" },
    { label: "COD", value: "cod" },
];

export const DISPATCH_TYPE_OPTIONS = [
    { label: "Priority", value: "priority" },
    { label: "Standard", value: "standard" },
];

export const ORDER_TYPE_OPTIONS = [
    { value: "telephone", label: "Telephonic Enquiry" },
    { value: "website", label: "Website" },
    { value: "salesperson", label: "Sales Person" },
    { value: "reference", label: "Reference" },
];

// New 7-type Order Source options (replaces ORDER_TYPE_OPTIONS for new orders)
export const ORDER_SOURCE_OPTIONS = [
    { value: "SALES_PERSON",  label: "Sales Person" },
    { value: "TELE_CALLING",  label: "Tele Calling" },
    { value: "WALK_IN",       label: "Walk-in" },
    { value: "WHATSAPP",      label: "WhatsApp" },
    { value: "REFERRAL",      label: "Referral" },
    { value: "REPEAT_ORDER",  label: "Repeat Order" },
    { value: "DEALER_AGENT",  label: "Dealer / Agent" },
];

// Sources that require an employee link
export const ORDER_SOURCE_NEEDS_EMPLOYEE = ["SALES_PERSON", "TELE_CALLING", "WALK_IN", "WHATSAPP"];
// Sources that require referral info (customer or name)
export const ORDER_SOURCE_NEEDS_REFERRAL = ["REFERRAL"];
// Sources that require dealer/agent name
export const ORDER_SOURCE_NEEDS_DEALER   = ["DEALER_AGENT"];

export const COLOUR_OPTIONS = [
    { value: "sc", label: "Single Color" },
    { value: "mc", label: "Multi Color" },
];

export const CUSTOMER_TYPE_OPTIONS = [
    { value: "B2B", label: "B2B (GST Registered)" },
    { value: "B2C", label: "B2C (Consumer)" },
    { value: "EXPORT", label: "Export" },
];

export const DATE_RANGE_OPTIONS = [
  { label: "Custom Range", value: "custom" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_week" },
  { label: "Last 30 Days", value: "last_month" },
  { label: "Last 6 Months", value: "last_6_months" },
  { label: "Last Year", value: "last_year" },
];