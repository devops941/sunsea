import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Modal } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { useUsers } from "../../../hooks/useUsers";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import { usePermission } from "../../../hooks/usePermission";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { userService } from "../../../services/userService";

const ITEMS_PER_PAGE = 15;

const UserList: React.FC = () => {
    const navigate = useNavigate();
    const { users, loading, error, loadUsers, changeUserStatus } = useUsers();
    const { can } = usePermission();
    const canEdit = can("users.edit");
    const canCreate = can("users.create");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const [formData, setFormData] = useState({
        username: "",
        fullName: "",
        isActive: "true",
    });

    usePageShortcuts({ onRefresh: () => loadUsers() });

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (showFormModal || showViewModal) return;
            if (document.querySelector("[data-select-portal]")) return;
            e.preventDefault();
            e.stopPropagation();
            navigate(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate, showFormModal, showViewModal]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const filteredUsers = useMemo(() => {
        const filtered = users.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (user.roleId && user.roleId.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        // Sort ascending by createdOn so last added comes last
        return [...filtered].sort((a, b) => {
            const dateA = a.createdOn ? new Date(a.createdOn).getTime() : 0;
            const dateB = b.createdOn ? new Date(b.createdOn).getTime() : 0;
            return dateA - dateB;
        });
    }, [users, searchTerm]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const fetchUsersForExport = useCallback(async () => {
        try {
            const list = await userService.fetchAll();
            return Array.isArray(list) ? list : [];
        } catch {
            return users;
        }
    }, [users]);

    const { csvColumns, csvFilename } = useMemo(() => {
        const columns = [
            { header: "Username", accessor: (item: any) => item.username || "" },
            { header: "Full Name", accessor: (item: any) => item.fullName || "" },
            { header: "Email", accessor: (item: any) => item.email || "" },
            { header: "Role", accessor: (item: any) => item.roleId || "" },
            { header: "Status", accessor: (item: any) => item.status || (item.isActive ? "Active" : "Inactive") },
        ];
        return {
            csvColumns: columns,
            csvFilename: `System_Users_${new Date().toISOString().split("T")[0]}.csv`,
        };
    }, []);



    const handleOpenEdit = (user: any) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            fullName: user.fullName,
            isActive: user.status === "active" ? "true" : "false",
        });
        setShowFormModal(true);
    };

    const handleOpenView = (user: any) => {
        setSelectedUser(user);
        setShowViewModal(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedUser) {
                await changeUserStatus(selectedUser.userId, formData.isActive === "true");
                toast.success("User status updated successfully!");
            }
            setShowFormModal(false);
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
    };



    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">User Management</h2>

                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search users..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                        data-search-input
                                    />
                                </div>
                                {can("users.export") && (
                                    <ExportCSVButton
                                        fetchData={fetchUsersForExport}
                                        columns={csvColumns}
                                        filename={csvFilename}
                                        text="Export"
                                    />
                                )}
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Users Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        {loading && users.length === 0 ? (
                            <div className="text-center p-5">
                                <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                            </div>
                        ) : (
                            <table className="master-data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>Username</th>
                                        <th>Full Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.length > 0 ? (
                                        paginatedUsers.map((user, index) => (
                                            <tr key={user.userId} className="master-data-row">
                                                <td className="master-data-cell">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="master-data-cell">{user.username}</td>
                                                <td className="master-data-cell">{user.fullName}</td>
                                                <td className="master-data-cell">{user.email || "N/A"}</td>
                                                <td className="master-data-cell">{user.roleId}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={user.status} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton onClick={() => handleOpenView(user)} />
                                                        {canEdit && <EditButton onClick={() => handleOpenEdit(user)} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="text-center p-4">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Modal */}
                <Modal show={showFormModal} onHide={() => setShowFormModal(false)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Edit User Status</Modal.Title>
                    </Modal.Header>
                    <form onSubmit={handleSubmit}>
                        <Modal.Body>
                            <Row className="g-3">
                                <Col md={12}>
                                    <TextInput
                                        label="Username"
                                        name="username"
                                        value={formData.username}
                                        disabled
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <TextInput
                                        label="Full Name"
                                        name="fullName"
                                        value={formData.fullName}
                                        disabled
                                        onChange={handleChange}
                                    />
                                </Col>
                                <Col md={12}>
                                    <SelectInput
                                        label="Status"
                                        name="isActive"
                                        value={formData.isActive}
                                        options={[
                                            { value: "true", label: "Active" },
                                            { value: "false", label: "Inactive/Suspended" },
                                        ]}
                                        onChange={handleChange}
                                    />
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            {canCreate && <CustomButton
                                text="Update"
                                icon={FaSave}
                                type="submit"
                                disabled={loading}
                            />}
                        </Modal.Footer>
                    </form>
                </Modal>

                {/* View Details Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="User Details"
                    avatarText={selectedUser ? selectedUser.fullName.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedUser ? selectedUser.fullName : ""}
                    headerSubtitle={selectedUser ? `@${selectedUser.username}` : ""}
                    sections={selectedUser ? [
                        {
                            fields: [
                                { label: "Role", value: selectedUser.roleId || "N/A" },
                                {
                                    label: "Status",
                                    value: <StatusBadge status={selectedUser.status} />
                                },
                                { label: "Email", value: selectedUser.email || "N/A", xs: 12 },
                                { label: "User ID", value: <span className="font-monospace small text-muted">{selectedUser.userId}</span>, xs: 12 }
                            ]
                        }
                    ] : []}
                />
            </Container>
        </div>
    );
};

export default UserList;
