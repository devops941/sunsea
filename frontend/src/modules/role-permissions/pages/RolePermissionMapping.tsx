import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner, Card, Form, Accordion, Badge } from "react-bootstrap";
import { FaCheckSquare, FaSquare, FaUserShield, FaSave, FaSlidersH, FaShieldAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useRoles } from "../../../hooks/useRoles";
import { usePermissions } from "../../../hooks/usePermissions";

// Define user-friendly groups for module permissions
const MODULE_GROUPS = [
    {
        id: "sales",
        groupName: "Sales & Customers",
        modules: ["sales-orders", "customers"]
    },
    {
        id: "purchase",
        groupName: "Purchase & Suppliers",
        modules: ["purchase-order-approvals", "supplier", "suppliers", "supplierpricelist"]
    },
    {
        id: "products",
        groupName: "Products & Materials Catalog",
        modules: ["products", "categories", "sub-categories", "colors", "sizes", "uoms", "product-pricing", "product-images", "raw_materials"]
    },
    {
        id: "inventory",
        groupName: "Inventory & Warehouses",
        modules: ["raw_material_stocks", "finished_goods_stocks", "stores", "storage-stores", "store-types", "locations"]
    },
    {
        id: "production",
        groupName: "Production & Machines",
        modules: ["machines", "shifts"]
    },
    {
        id: "admin",
        groupName: "System Administration & HR",
        modules: ["users", "roles", "permissions", "role-permissions", "employees", "departments", "profile"]
    },
    {
        id: "reports",
        groupName: "Analytics & Reports",
        modules: ["reports"]
    }
];

// Helper to format module keys into readable labels
const formatModuleLabel = (mod: string): string => {
    const mapping: Record<string, string> = {
        "sales-orders": "Sales Orders",
        "customers": "Customers",
        "purchase-order-approvals": "Purchase Approvals",
        "supplier": "Supplier Master",
        "suppliers": "Suppliers List",
        "supplierpricelist": "Supplier Pricing",
        "products": "Product Master",
        "categories": "Categories",
        "sub-categories": "Sub-Categories",
        "colors": "Colors",
        "sizes": "Sizes",
        "uoms": "Units of Measure (UOM)",
        "product-pricing": "Product Pricing",
        "product-images": "Product Gallery",
        "raw_materials": "Raw Materials",
        "raw_material_stocks": "Raw Material Stocks",
        "finished_goods_stocks": "Finished Goods Stocks",
        "stores": "Stores Config",
        "storage-stores": "Warehouses",
        "store-types": "Store Types",
        "locations": "Store Locations",
        "machines": "Machines List",
        "shifts": "Shift Schedules",
        "users": "System Users",
        "roles": "User Roles",
        "permissions": "Permissions Registry",
        "role-permissions": "Role Mappings",
        "employees": "Employee Directory",
        "departments": "Departments & Designations",
        "profile": "User Profile",
        "reports": "System Reports"
    };
    return mapping[mod] || mod.charAt(0).toUpperCase() + mod.slice(1).replace("-", " ").replace("_", " ");
};

const RolePermissionMapping: React.FC = () => {
    const { roles, loadRoles } = useRoles();
    const {
        permissions,
        rolePermissions,
        loading,
        loadPermissions,
        loadRolePermissions,
        assignPermissionsToRole,
        removePermissionFromRole,
    } = usePermissions();

    const [selectedRoleId, setSelectedRoleId] = useState<string>("");

    useEffect(() => {
        loadRoles();
        loadPermissions();
    }, [loadRoles, loadPermissions]);

    useEffect(() => {
        if (roles.length > 0 && !selectedRoleId) {
            setSelectedRoleId(String(roles[0].id));
        }
    }, [roles, selectedRoleId]);

    useEffect(() => {
        if (selectedRoleId) {
            loadRolePermissions(Number(selectedRoleId));
        }
    }, [selectedRoleId, loadRolePermissions]);

    const activeRoleId = Number(selectedRoleId);

    const assignedPermissionIds = useMemo(() => {
        return (rolePermissions[activeRoleId] || []).map((p) => p.id);
    }, [rolePermissions, activeRoleId]);

    // Group active database permissions by our user-friendly UI sections
    const groupedPermissions = useMemo(() => {
        return MODULE_GROUPS.map((group) => {
            // Find all permissions matching module keys in this group
            const matchedPerms = permissions.filter((p) => group.modules.includes(p.module));

            // Subgroup by module for detailed rows
            const subModules = group.modules.map(mod => {
                const modPerms = matchedPerms.filter(p => p.module === mod);
                return {
                    moduleKey: mod,
                    label: formatModuleLabel(mod),
                    permissions: modPerms
                };
            }).filter(sub => sub.permissions.length > 0);

            return {
                ...group,
                subModules,
                totalCount: matchedPerms.length,
                assignedCount: matchedPerms.filter(p => assignedPermissionIds.includes(p.id)).length
            };
        }).filter(g => g.totalCount > 0);
    }, [permissions, assignedPermissionIds]);

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedRoleId(e.target.value);
    };

    const handleTogglePermission = async (permissionId: number) => {
        if (!selectedRoleId) return;
        const isAssigned = assignedPermissionIds.includes(permissionId);
        try {
            if (isAssigned) {
                await removePermissionFromRole(activeRoleId, permissionId);
                toast.success("Permission revoked successfully!");
            } else {
                await assignPermissionsToRole(activeRoleId, [permissionId]);
                toast.success("Permission granted successfully!");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update permission mapping");
        }
    };

    const handleSelectAllInGroup = async (e: React.MouseEvent, groupPermissions: typeof permissions) => {
        e.stopPropagation();
        if (!selectedRoleId) return;
        
        const groupPermIds = groupPermissions.map(p => p.id);
        const allSelected = groupPermIds.every(id => assignedPermissionIds.includes(id));

        try {
            if (allSelected) {
                for (const id of groupPermIds) {
                    await removePermissionFromRole(activeRoleId, id);
                }
                toast.success("Group permissions revoked!");
            } else {
                const toAssign = groupPermIds.filter(id => !assignedPermissionIds.includes(id));
                if (toAssign.length > 0) {
                    await assignPermissionsToRole(activeRoleId, toAssign);
                    toast.success("Group permissions granted!");
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
    };

    const roleOptions = useMemo(() => {
        return roles.map((r) => ({ value: String(r.id), label: r.name }));
    }, [roles]);

    const selectedRoleName = useMemo(() => {
        const role = roles.find(r => String(r.id) === selectedRoleId);
        return role ? role.name : "";
    }, [roles, selectedRoleId]);

    return (
        <div className="inner-container py-4">
            <style>{`
                .role-perm-title {
                    color: var(--color-primary) !important;
                    font-family: 'head-font', sans-serif;
                }
                .role-perm-accordion.accordion {
                    --bs-accordion-border-color: transparent;
                    --bs-accordion-bg: transparent;
                    gap: 12px;
                    display: flex;
                    flex-direction: column;
                }
                .role-perm-accordion .accordion-item {
                    border-radius: 12px !important;
                    border: 1px solid rgba(0,0,0,0.05) !important;
                    background-color: var(--color-white);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
                    transition: all 0.2s ease-in-out;
                    overflow: hidden;
                }
                .role-perm-accordion .accordion-item:hover {
                    box-shadow: 0 6px 16px rgba(0, 52, 40, 0.08);
                    border-color: rgba(0, 52, 40, 0.1) !important;
                }
                .role-perm-accordion .accordion-header button {
                    font-family: 'head-font', sans-serif;
                    font-size: 1rem !important;
                    font-weight: 700 !important;
                    color: var(--color-primary) !important;
                    background-color: var(--color-white) !important;
                    box-shadow: none !important;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid transparent;
                    transition: all 0.2s;
                }
                .role-perm-accordion .accordion-button:not(.collapsed) {
                    background-color: rgba(0, 52, 40, 0.04) !important;
                    color: var(--color-primary) !important;
                    border-bottom: 1px solid rgba(0, 52, 40, 0.1) !important;
                }
                .role-perm-table {
                    margin-bottom: 0 !important;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .role-perm-table thead {
                    background: #f8f9fa !important;
                }
                .role-perm-table th {
                    color: var(--color-primary) !important;
                    font-family: 'head-font', sans-serif;
                    font-weight: 700 !important;
                    font-size: 12px !important;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid rgba(0,0,0,0.05) !important;
                    padding: 14px 16px !important;
                }
                .role-perm-table td {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid rgba(0,0,0,0.03) !important;
                    font-size: 0.85rem !important;
                    vertical-align: middle;
                }
                .role-perm-table tbody tr {
                    transition: background-color 0.2s;
                }
                .role-perm-table tbody tr:hover {
                    background-color: rgba(0, 52, 40, 0.02) !important;
                }
                .role-perm-badge-active {
                    background-color: var(--color-secondary) !important;
                    color: var(--color-white) !important;
                    font-size: 0.85rem !important;
                    font-weight: 600 !important;
                    padding: 8px 16px !important;
                    border-radius: 8px !important;
                    border: none !important;
                    box-shadow: 0 4px 10px rgba(203, 122, 33, 0.3);
                }
                .role-perm-badge-assigned {
                    background-color: var(--color-primary) !important;
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    color: var(--color-white) !important;
                    border-radius: 6px;
                    padding: 4px 10px;
                }
                .role-perm-table .form-check-input {
                    cursor: pointer;
                    width: 2.5em;
                    height: 1.25em;
                }
                .role-perm-table .form-check-input:checked {
                    background-color: var(--color-secondary) !important;
                    border-color: var(--color-secondary) !important;
                }
                .role-perm-table .form-check-input:focus {
                    border-color: var(--color-secondary-light) !important;
                    box-shadow: 0 0 0 0.25rem rgba(203, 122, 33, 0.2) !important;
                }
                .role-perm-table .form-check-label {
                    cursor: pointer;
                    margin-top: 2px;
                }
                .role-perm-select-all {
                    color: var(--color-secondary) !important;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                    background: rgba(203, 122, 33, 0.1);
                    padding: 6px 12px;
                    border-radius: 6px;
                }
                .role-perm-select-all:hover {
                    background: rgba(203, 122, 33, 0.15);
                    transform: translateY(-1px);
                }
            `}</style>
            <Container fluid>
                {/* HEADER SECTION */}
                <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border">
                    <div>
                        <h2 className="mb-1 fw-bold role-perm-title" style={{ fontSize: "1.6rem" }}>
                            Role Permissions Mapping
                        </h2>
                        <div className="text-muted small">Administration / Security / Role Mappings</div>
                    </div>
                    <div>
                        <Badge className="p-2 fs-6 role-perm-badge-active">
                            <FaShieldAlt className="me-2" />
                            {assignedPermissionIds.length} Active Permissions
                        </Badge>
                    </div>
                </div>

                {/* ROLE SELECTOR CARD */}
                <Card className="mb-4 border-0 shadow-sm">
                    <Card.Body className="p-4 bg-light rounded border">
                        <Row className="align-items-center g-3">
                            <Col md={4}>
                                <SelectInput
                                    label="Select Role to Map Permissions*"
                                    name="roleSelector"
                                    value={selectedRoleId}
                                    options={roleOptions}
                                    onChange={handleRoleChange}
                                />
                            </Col>
                            <Col md={8}>
                                <div className="p-3 bg-white rounded border d-flex align-items-center gap-3">
                                    <FaSlidersH className="text-secondary fs-3" />
                                    <div>
                                        <h6 className="mb-1 fw-bold text-dark">Configuring permissions for role: <span className="text-primary">{selectedRoleName || "None"}</span></h6>
                                        <p className="mb-0 text-muted small">
                                            Select or deselect permission items below. Changes are saved automatically in real-time.
                                        </p>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* PERMISSIONS MATRIX */}
                {loading && permissions.length === 0 ? (
                    <div className="text-center p-5">
                        <Spinner animation="border" variant="primary" className="mb-2" />
                        <div className="text-muted">Loading permission registry...</div>
                    </div>
                ) : (
                    <Accordion defaultActiveKey="0" className="shadow-sm role-perm-accordion">
                        {groupedPermissions.map((group, grpIdx) => {
                            const allGroupPerms = group.subModules.flatMap(sm => sm.permissions);
                            const isAllSelected = allGroupPerms.every(p => assignedPermissionIds.includes(p.id));

                            return (
                                <Accordion.Item eventKey={String(grpIdx)} key={group.id} className="border mb-3 rounded overflow-hidden">
                                    <Accordion.Header className="bg-light">
                                        <div className="d-flex align-items-center justify-content-between w-100 pe-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "1rem" }}>
                                                    {group.groupName}
                                                </h5>
                                                <Badge className="role-perm-badge-assigned">
                                                    {group.assignedCount} / {group.totalCount} Assigned
                                                </Badge>
                                            </div>
                                            <div
                                                className="d-flex align-items-center gap-2 role-perm-select-all"
                                                onClick={(e) => handleSelectAllInGroup(e, allGroupPerms)}
                                            >
                                                {isAllSelected ? <FaCheckSquare className="text-success" /> : <FaSquare />}
                                                {isAllSelected ? "Deselect All" : "Select All Group"}
                                            </div>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body className="p-0">
                                        <div className="table-responsive">
                                            <table className="table table-hover table-striped mb-0 align-middle role-perm-table">
                                                <thead className="table-light text-secondary small">
                                                    <tr>
                                                        <th style={{ width: "250px", paddingLeft: "1.5rem" }}>Sub-Module</th>
                                                        <th>View (Read)</th>
                                                        <th>Create (Add)</th>
                                                        <th>Edit (Update)</th>
                                                        <th>Delete (Remove)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.subModules.map((sub) => {
                                                        // Group sub-module permissions by action categories
                                                        const viewPerm = sub.permissions.find(p => p.action === "view");
                                                        const createPerm = sub.permissions.find(p => p.action === "create");
                                                        const editPerm = sub.permissions.find(p => p.action === "edit");
                                                        const deletePerm = sub.permissions.find(p => p.action === "delete");

                                                        return (
                                                            <tr key={sub.moduleKey}>
                                                                <td className="fw-semibold text-dark" style={{ paddingLeft: "1.5rem" }}>
                                                                    {sub.label}
                                                                </td>
                                                                <td>
                                                                    {viewPerm ? (
                                                                        <Form.Check 
                                                                            type="switch"
                                                                            id={`perm-${viewPerm.id}`}
                                                                            checked={assignedPermissionIds.includes(viewPerm.id)}
                                                                            onChange={() => handleTogglePermission(viewPerm.id)}
                                                                            label={viewPerm.description || "View"}
                                                                            className="small text-muted"
                                                                        />
                                                                    ) : <span className="text-muted small">-</span>}
                                                                </td>
                                                                <td>
                                                                    {createPerm ? (
                                                                        <Form.Check 
                                                                            type="switch"
                                                                            id={`perm-${createPerm.id}`}
                                                                            checked={assignedPermissionIds.includes(createPerm.id)}
                                                                            onChange={() => handleTogglePermission(createPerm.id)}
                                                                            label={createPerm.description || "Create"}
                                                                            className="small text-muted"
                                                                        />
                                                                    ) : <span className="text-muted small">-</span>}
                                                                </td>
                                                                <td>
                                                                    {editPerm ? (
                                                                        <Form.Check 
                                                                            type="switch"
                                                                            id={`perm-${editPerm.id}`}
                                                                            checked={assignedPermissionIds.includes(editPerm.id)}
                                                                            onChange={() => handleTogglePermission(editPerm.id)}
                                                                            label={editPerm.description || "Edit"}
                                                                            className="small text-muted"
                                                                        />
                                                                    ) : <span className="text-muted small">-</span>}
                                                                </td>
                                                                <td>
                                                                    {deletePerm ? (
                                                                        <Form.Check 
                                                                            type="switch"
                                                                            id={`perm-${deletePerm.id}`}
                                                                            checked={assignedPermissionIds.includes(deletePerm.id)}
                                                                            onChange={() => handleTogglePermission(deletePerm.id)}
                                                                            label={deletePerm.description || "Delete"}
                                                                            className="small text-muted"
                                                                        />
                                                                    ) : <span className="text-muted small">-</span>}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            );
                        })}
                    </Accordion>
                )}
            </Container>
        </div>
    );
};

export default RolePermissionMapping;