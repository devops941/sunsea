import React, { useState, useEffect, useMemo } from "react";
import { FaCheckSquare, FaSquare, FaSlidersH, FaShieldAlt, FaSpinner, FaCube, FaShoppingCart, FaBoxOpen, FaWarehouse, FaCogs, FaUsersCog, FaChartBar } from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useRoles } from "../../../hooks/useRoles";
import { usePermissions } from "../../../hooks/usePermissions";

// Define user-friendly groups for module permissions
const MODULE_GROUPS = [
    {
        id: "sales",
        groupName: "Sales & Customers",
        icon: <FaShoppingCart />,
        modules: ["sales-orders", "customers"]
    },
    {
        id: "purchase",
        groupName: "Purchase & Suppliers",
        icon: <FaBoxOpen />,
        modules: ["purchase-order-approvals", "supplier", "suppliers", "supplierpricelist"]
    },
    {
        id: "products",
        groupName: "Products & Catalog",
        icon: <FaCube />,
        modules: ["products", "categories", "sub-categories", "colors", "sizes", "uoms", "product-pricing", "product-images", "raw_materials"]
    },
    {
        id: "inventory",
        groupName: "Inventory & Storage",
        icon: <FaWarehouse />,
        modules: ["raw_material_stocks", "finished_goods_stocks", "stores", "storage-stores", "store-types", "locations"]
    },
    {
        id: "production",
        groupName: "Production & Machines",
        icon: <FaCogs />,
        modules: ["machines", "shifts"]
    },
    {
        id: "admin",
        groupName: "System Admin & HR",
        icon: <FaUsersCog />,
        modules: ["users", "roles", "permissions", "role-permissions", "employees", "departments", "profile"]
    },
    {
        id: "reports",
        groupName: "Analytics & Reports",
        icon: <FaChartBar />,
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
    const [activeTabId, setActiveTabId] = useState<string>("sales");

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
            const matchedPerms = permissions.filter((p) => group.modules.includes(p.module));
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

    const activeGroup = groupedPermissions.find(g => g.id === activeTabId) || groupedPermissions[0];

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
        <div className="w-full px-6 py-8 max-w-[1400px] mx-auto font-sans bg-gray-50/30 min-h-screen">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                        Role Permissions Matrix
                    </h2>
                    <p className="text-gray-500 text-base max-w-2xl">
                        Manage granular access controls across different modules. Select a role and configure their permissions using the interactive matrix.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FaShieldAlt className="text-xl" />
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 font-medium">Total Active</div>
                        <div className="text-xl font-bold text-gray-900 leading-none">{assignedPermissionIds.length}</div>
                    </div>
                </div>
            </div>

            {/* ROLE SELECTOR CARD */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 mb-8">
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-4">
                            <SelectInput
                                label="Target Role"
                                name="roleSelector"
                                value={selectedRoleId}
                                options={roleOptions}
                                onChange={handleRoleChange}
                            />
                        </div>
                        <div className="lg:col-span-8">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-3 bg-primary/5 text-primary rounded-xl shadow-sm">
                                    <FaSlidersH className="text-2xl" />
                                </div>
                                <div>
                                    <h6 className="text-lg font-bold text-gray-900 mb-1">
                                        Modifying Policy: <span className="text-primary">{selectedRoleName || "None"}</span>
                                    </h6>
                                    <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
                                        Changes applied below take effect immediately. Ensure you are editing the correct role before modifying access levels.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA - SIDEBAR TABS & MATRIX */}
            {loading && permissions.length === 0 ? (
                <CommonLoader text="Loading security policies..." fullScreen={false} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    
                    {/* LEFT SIDEBAR - MODULE GROUPS */}
                    <div className="lg:col-span-1 space-y-2">
                        {groupedPermissions.map((group) => {
                            const isActive = activeTabId === group.id;
                            const isFullyAssigned = group.totalCount > 0 && group.assignedCount === group.totalCount;
                            
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveTabId(group.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 text-left border ${
                                        isActive 
                                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
                                            : 'bg-white border-transparent hover:border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`text-xl ${isActive ? 'text-white/90' : 'text-gray-400'}`}>
                                            {group.icon}
                                        </div>
                                        <span className="font-semibold">{group.groupName}</span>
                                    </div>
                                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                        isActive 
                                            ? 'bg-white/20 text-white' 
                                            : isFullyAssigned 
                                                ? 'bg-green-100 text-green-700' 
                                                : group.assignedCount > 0 
                                                    ? 'bg-secondary/10 text-secondary' 
                                                    : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {group.assignedCount}/{group.totalCount}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* RIGHT AREA - PERMISSIONS MATRIX */}
                    <div className="lg:col-span-3">
                        {activeGroup && (
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Matrix Header */}
                                <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white shadow-sm rounded-xl text-primary text-2xl">
                                            {activeGroup.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{activeGroup.groupName}</h3>
                                            <p className="text-sm text-gray-500 mt-1">Configure granular access for this module group.</p>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={(e) => handleSelectAllInGroup(e, activeGroup.subModules.flatMap(sm => sm.permissions))}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 transition-all shadow-sm"
                                    >
                                        {activeGroup.subModules.flatMap(sm => sm.permissions).every(p => assignedPermissionIds.includes(p.id)) ? (
                                            <><FaCheckSquare className="text-primary text-lg" /> Deselect All Group</>
                                        ) : (
                                            <><FaSquare className="text-gray-300 text-lg" /> Select All Group</>
                                        )}
                                    </button>
                                </div>

                                {/* Matrix Body */}
                                <div className="p-0 overflow-x-auto flex-1">
                                    <table className="w-full text-left border-collapse min-w-[750px]">
                                        <thead>
                                            <tr className="bg-white border-b-2 border-gray-100">
                                                <th className="py-5 px-8 text-xs font-extrabold text-gray-400 uppercase tracking-widest w-[250px]">Entity</th>
                                                <th className="py-5 px-6 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Read</th>
                                                <th className="py-5 px-6 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Write</th>
                                                <th className="py-5 px-6 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Modify</th>
                                                <th className="py-5 px-6 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {activeGroup.subModules.map((sub) => {
                                                const viewPerm = sub.permissions.find(p => p.action === "view");
                                                const createPerm = sub.permissions.find(p => p.action === "create");
                                                const editPerm = sub.permissions.find(p => p.action === "edit");
                                                const deletePerm = sub.permissions.find(p => p.action === "delete");

                                                return (
                                                    <tr key={sub.moduleKey} className="hover:bg-gray-50/80 transition-colors group">
                                                        <td className="py-5 px-8">
                                                            <div className="font-bold text-gray-900">{sub.label}</div>
                                                            <div className="text-xs text-gray-400 font-medium mt-1 font-mono">{sub.moduleKey}</div>
                                                        </td>
                                                        {[
                                                            { perm: viewPerm, color: "bg-blue-500", label: "Read" },
                                                            { perm: createPerm, color: "bg-emerald-500", label: "Write" },
                                                            { perm: editPerm, color: "bg-amber-500", label: "Modify" },
                                                            { perm: deletePerm, color: "bg-rose-500", label: "Remove" }
                                                        ].map((item, idx) => (
                                                            <td key={idx} className="py-5 px-6">
                                                                {item.perm ? (
                                                                    <label className="relative inline-flex items-center cursor-pointer group/toggle">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            className="sr-only peer" 
                                                                            checked={assignedPermissionIds.includes(item.perm.id)}
                                                                            onChange={() => handleTogglePermission(item.perm!.id)} 
                                                                        />
                                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                                                    </label>
                                                                ) : (
                                                                    <div className="w-11 flex justify-center text-gray-300">
                                                                        <div className="w-2 h-[2px] bg-gray-200 rounded"></div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolePermissionMapping;