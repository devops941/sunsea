import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaCog, FaBuilding, FaUsersCog, FaChevronRight, FaChevronLeft } from "react-icons/fa";
import type { TabItem } from "../../components/ui/tab/Tabs";
import Tabs from "../../components/ui/tab/Tabs";
import ViewButton from "../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../components/ui/StatusBadge/Badge";


// ─── Report-style Section wrapper (reuse the same pattern as your other pages) ──
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div
        className="mb-4 p-4"
        style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        <div className="d-flex align-items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {icon && (
                <span
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(203, 122, 33, 0.1)",
                        color: "var(--color-secondary)",
                    }}
                >
                    {icon}
                </span>
            )}
            <h6 className="mb-0 fw-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}>{title}</h6>
        </div>
        {children}
    </div>
);

const GeneralSettingsTab: React.FC = () => (
    <Section title="General Settings" icon={<FaCog />}>
        <Row>
            <Col md={6}>
                {/* your general settings fields go here */}
                <p className="text-muted mb-0">Company name, timezone, currency, etc.</p>
            </Col>
        </Row>
    </Section>
);

const CompanyProfileTab: React.FC = () => (
    <Section title="Company Profile" icon={<FaBuilding />}>
        <p className="text-muted mb-0">Address, logo, registration details, etc.</p>
    </Section>
);



const SettingPage: React.FC = () => {
    const tabs: TabItem[] = [
        { key: "general", label: "General Settings", icon: <FaCog />, content: <GeneralSettingsTab /> },
        { key: "company", label: "Company Profile", icon: <FaBuilding />, content: <CompanyProfileTab /> },
    ];

    return (
        <div className="inner-container">
            <Container fluid>


                <Tabs tabs={tabs} defaultActiveKey="general" />
            </Container>
        </div>
    );
};

export default SettingPage;