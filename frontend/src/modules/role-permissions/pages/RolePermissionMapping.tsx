import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaCheckSquare, FaSquare, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useRoles } from "../../../hooks/useRoles";
import { usePermissions } from "../../../hooks/usePermissions";
import { sidebarItems } from "../../../components/common/sidebar/sidebar.data";

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
    const [expandedModule, setExpandedModule] = useState<string | null>(null);

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

    const assignedPermissionsForRole = useMemo(() => {
        return rolePermissions[activeRoleId] || [];
    }, [rolePermissions, activeRoleId]);

    const assignedPermissionIds = useMemo(() => {
        return assignedPermissionsForRole.map((p) => p.id);
    }, [assignedPermissionsForRole]);

    // Helper function to recursively extract permission keys
    const extractPermissions = (items: any[]): string[] => {
        let perms: string[] = [];
        for (const item of items) {
            if (item.permission) perms.push(item.permission);
            if (item.children) perms = perms.concat(extractPermissions(item.children));
        }
        return perms;
    };

    // Group permissions by sidebar section, matching on the resource
    // prefix of each permission key (e.g. "users" from "users.view").
    const permissionsByModule = useMemo(() => {
        return sidebarItems
            .map((sidebar) => {
                const childPermissionKeys = extractPermissions(sidebar.children || []);

                const groupedPermissions = permissions.filter((perm) => {
                    const resource = perm.key.split(".")[0];
                    return childPermissionKeys.some((sidebarPerm) => {
                        const sidebarResource = sidebarPerm.split(".")[0];
                        return sidebarResource === resource;
                    });
                });

                return {
                    module: sidebar.title,
                    permissions: groupedPermissions,
                };
            })
            .filter((group) => group.permissions.length > 0);
    }, [permissions]);

    useEffect(() => {
        if (permissionsByModule.length > 0 && expandedModule === null) {
            setExpandedModule(permissionsByModule[0].module);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsByModule]);

    const toggleModuleExpanded = (moduleName: string) => {
        setExpandedModule((prev) => (prev === moduleName ? null : moduleName));
    };

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
            toast.error(err.message || "Failed to update mapping");
        }
    };

    const handleSelectAllInModule = async (
        e: React.MouseEvent,
        modulePermissions: typeof permissions
    ) => {
        e.stopPropagation();
        if (!selectedRoleId) return;
        const modulePermIds = modulePermissions.map((p) => p.id);
        const allSelected = modulePermIds.every((id) => assignedPermissionIds.includes(id));

        try {
            if (allSelected) {
                for (const id of modulePermIds) {
                    await removePermissionFromRole(activeRoleId, id);
                }
                toast.success("All permissions in module revoked!");
            } else {
                const toAssign = modulePermIds.filter((id) => !assignedPermissionIds.includes(id));
                if (toAssign.length > 0) {
                    await assignPermissionsToRole(activeRoleId, toAssign);
                    toast.success("All permissions in module granted!");
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
    };

    const roleOptions = useMemo(() => {
        return roles.map((r) => ({ value: String(r.id), label: r.name }));
    }, [roles]);

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Role Permissions Mapping</h2>
                                <div className="page-breadcrumb">Home / Administration / Role Permissions</div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <div className="form-inner mb-4">
                    <Row className="align-items-center">
                        <Col md={4}>
                            <SelectInput
                                label="Select Role"
                                name="roleSelector"
                                value={selectedRoleId}
                                options={roleOptions}
                                onChange={handleRoleChange}
                            />
                        </Col>
                        <Col md={8}>
                            <div className="info-item mt-3 mt-md-0">
                                <label className="text-muted small">Assigned Summary</label>
                                <p className="mb-0 fw-bold text-success">
                                    {assignedPermissionIds.length} active permissions configured for this role.
                                </p>
                            </div>
                        </Col>
                    </Row>
                </div>

                {loading && permissions.length === 0 ? (
                    <div className="text-center p-5">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : (
                    <div className="master-table">
                        <div className="table-wrap">
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 60 }}>#</th>
                                        <th>Permission</th>
                                        <th>Description</th>
                                        <th style={{ textAlign: "center", width: 100 }}>Assigned</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionsByModule.map((grp) => {
                                        const isExpanded = expandedModule === grp.module;
                                        const isAllSelected = grp.permissions.every((p) =>
                                            assignedPermissionIds.includes(p.id)
                                        );
                                        const assignedCount = grp.permissions.filter((p) =>
                                            assignedPermissionIds.includes(p.id)
                                        ).length;

                                        return (
                                            <React.Fragment key={grp.module}>
                                                <tr
                                                    className="master-data-row"
                                                    style={{
                                                        cursor: "pointer",
                                                        background: "rgba(0, 52, 40, 0.05)",
                                                    }}
                                                    onClick={() => toggleModuleExpanded(grp.module)}
                                                >
                                                    <td
                                                        className="master-data-cell"
                                                        colSpan={5}
                                                        style={{ padding: "14px 22px" }}
                                                    >
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span style={{ color: "var(--color-primary)", fontSize: "0.85rem" }}>
                                                                    {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                                                </span>
                                                                <span className="fw-bold" style={{ color: "var(--color-primary)", fontSize: "15px" }}>
                                                                    {grp.module}
                                                                </span>
                                                                <span className="badge bg-light text-secondary small">
                                                                    {assignedCount}/{grp.permissions.length}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="d-flex align-items-center gap-2"
                                                                style={{ color: "var(--color-secondary)", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                                                                onClick={(e) => handleSelectAllInModule(e, grp.permissions)}
                                                            >
                                                                {isAllSelected ? <FaCheckSquare /> : <FaSquare />}
                                                                {isAllSelected ? "Deselect All" : "Select All"}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isExpanded &&
                                                    grp.permissions.map((perm, permIdx) => {
                                                        const isAssigned = assignedPermissionIds.includes(perm.id);
                                                        return (
                                                            <tr key={perm.id} className="master-data-row">
                                                                <td className="master-data-cell" style={{ textAlign: "center" }}>
                                                                    {permIdx + 1}
                                                                </td>
                                                                <td className="master-data-cell fw-semibold">{perm.action}</td>
                                                                <td className="master-data-cell text-muted">
                                                                    {perm.description || "No description"}
                                                                </td>
                                                                <td
                                                                    className="master-data-cell"
                                                                    style={{ textAlign: "center", cursor: "pointer" }}
                                                                    onClick={() => handleTogglePermission(perm.id)}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            color: isAssigned ? "var(--color-secondary)" : "var(--color-text-muted)",
                                                                            fontSize: "1.2rem",
                                                                        }}
                                                                    >
                                                                        {isAssigned ? <FaCheckSquare /> : <FaSquare />}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
};

export default RolePermissionMapping;