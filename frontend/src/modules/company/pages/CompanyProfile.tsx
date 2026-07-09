import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaHashtag, FaEdit, FaFileInvoiceDollar, FaPhone, FaServer } from 'react-icons/fa';
import type { RootState, AppDispatch } from '../../../app/store';
import { fetchCompany } from '../../../features/company/companySlice';
import CustomButton from '../../../components/ui/Button/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge/Badge';
import Logo from '../../../assets/images/sun-sea.webp';
import './CompanyProfile.css';

const CompanyProfile: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { data: company, loading } = useSelector((state: RootState) => state.company);
  const { user } = useSelector((state: RootState) => state.auth);

  const canEdit = user?.roleId === "ROLE_ADMIN";

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  if (loading || !company) return <div className="text-center p-5 mt-5 fw-bold text-primary">Loading company profile...</div>;

  return (
    <div className="cp-wrapper">
      <div className="cp-card">

        {/* HEADER */}
        <div className="cp-header">
          <div className="cp-header-left">
            <div className="cp-logo" style={{ overflow: 'hidden', padding: '5px' }}>
              <img src={company.logoUrl || Logo} alt="Company Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="cp-company-title">
              <h2 className="cp-company-name">{company.legalName || company.companyName || "Your Company"}</h2>
              <span className="cp-company-type">
                <FaBuilding style={{ marginRight: '6px' }} />
                Enterprise Company Profile
              </span>
            </div>
          </div>
          <div className="cp-header-right">
            <div className="cp-code-status">
              <span className="cp-company-code me-3">
                <FaHashtag style={{ marginRight: '6px' }} />
                {company.companyCode || "-"}
              </span>
              <StatusBadge status={company.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="cp-body">
          {/* General */}
          <div className="cp-section">
            <div className="cp-section-title">
              <FaBuilding /> General Information
            </div>
            <div className="cp-grid">
              <div className="cp-info-item">
                <span className="cp-info-label">Legal Name</span>
                <span className="cp-info-value">{company.legalName || company.companyName || "-"}</span>
              </div>
           
              <div className="cp-info-item">
                <span className="cp-info-label">Company Code</span>
                <span className="cp-info-value">{company.companyCode || "-"}</span>
              </div>
            </div>
          </div>

          {/* Registration */}
          <div className="cp-section">
            <div className="cp-section-title">
              <FaFileInvoiceDollar /> Registration Details
            </div>
            <div className="cp-grid">
              <div className="cp-info-item">
                <span className="cp-info-label">GSTIN</span>
                <span className="cp-info-value">{company.gstin || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">Currency</span>
                <span className="cp-info-value" style={{ fontWeight: 600 }}>
                  {company.currencyCode || "INR"}
                </span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="cp-section">
            <div className="cp-section-title">
              <FaBuilding /> Address Information
            </div>
            <div className="cp-grid">
              <div className="cp-info-item">
                <span className="cp-info-label">Address Line 1</span>
                <span className="cp-info-value">{company.addressLine1 || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">Address Line 2</span>
                <span className="cp-info-value">{company.addressLine2 || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">City</span>
                <span className="cp-info-value">{company.city || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">State</span>
                <span className="cp-info-value">{company.state || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">Zipcode</span>
                <span className="cp-info-value">{company.zipcode || "-"}</span>
              </div>
              <div className="cp-info-item">
                <span className="cp-info-label">Country</span>
                <span className="cp-info-value">{company.country || "-"}</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="cp-section">
            <div className="cp-section-title">
              <FaPhone /> Contact Information
            </div>
            <div className="cp-grid">
              <div className="cp-info-item">
                <span className="cp-info-label">Phone</span>
                <span className="cp-info-value">{company.phone || "-"}</span>
              </div>
              {/* <div className="cp-info-item">
                <span className="cp-info-label">Mobile</span>
                <span className="cp-info-value">{company.mobile || "-"}</span>
              </div> */}
              <div className="cp-info-item">
                <span className="cp-info-label">Email</span>
                <span className="cp-info-value">{company.email || "-"}</span>
              </div>
              {/* <div className="cp-info-item">
                <span className="cp-info-label">Website</span>
                <span className="cp-info-value">{company.website || "-"}</span>
              </div> */}
            </div>
          </div>

          {/* System */}
          <div className="cp-section">
            <div className="cp-section-title">
              <FaServer /> System Information
            </div>
            <div className="cp-grid">
              <div className="cp-info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="cp-info-label">Logo Image</span>
                <span className="cp-info-value mt-2 d-block">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="Company Logo" style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #eee', padding: '5px', borderRadius: '4px' }} />
                  ) : (
                    "No Logo Uploaded"
                  )}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="cp-footer">
          {canEdit && (
            <CustomButton text="Edit Company Profile" icon={FaEdit} onClick={() => navigate('/company/edit')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;
