import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FaBuilding, FaHashtag, FaEdit, FaFileInvoiceDollar, FaPhone, FaServer } from 'react-icons/fa';
import type { RootState, AppDispatch } from '../../../app/store';
import { fetchCompany } from '../../../features/company/companySlice';
import CustomButton from '../../../components/ui/Button/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge/Badge';
import Logo from '../../../assets/images/sun-sea.webp';

const CompanyProfile: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { data: company, loading } = useSelector((state: RootState) => state.company);
  const { user } = useSelector((state: RootState) => state.auth);

  const canEdit = user?.roleId === "ROLE_ADMIN";

  useEffect(() => {
    dispatch(fetchCompany());
  }, [dispatch]);

  if (loading || !company) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin  h-10 w-10 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-indigo-600 font-medium">Loading company profile...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen bg-linear-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden transition-all duration-300 hover:shadow-md">

        {/* HEADER */}
        <div className="bg-linear-to-r from-indigo-600 via-blue-600 to-blue-500 px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-xl shadow-md border-2 border-white/20 flex items-center justify-center p-2 shrink-0 overflow-hidden">
              <img src={company.logoUrl || Logo} alt="Company Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {company.legalName || company.companyName || "Your Company"}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm font-medium text-blue-100">
                <FaBuilding className="text-blue-200" />
                <span>Enterprise Company Profile</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-card/10 backdrop-blur-md px-4 py-2 rounded-xl shadow-sm border border-white/20">
            <div className="flex items-center gap-2 text-white font-medium">
              <FaHashtag className="text-blue-200" />
              <span>{company.companyCode || "-"}</span>
            </div>
            <div className="w-px h-5 bg-card/30"></div>
            <div className="bg-card rounded-full"><StatusBadge status={company.isActive ? "ACTIVE" : "INACTIVE"} /></div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-8">

          {/* General */}
          <section>
            <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-widest flex items-center gap-2 border-b border-line-soft pb-2 mb-4">
              <FaBuilding className="text-indigo-400" />
              General Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Legal Name</span>
                <span className="text-sm font-bold text-ink">{company.legalName || company.companyName || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Company Code</span>
                <span className="text-sm font-bold text-ink">{company.companyCode || "-"}</span>
              </div>
            </div>
          </section>

          {/* Registration */}
          <section>
            <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-widest flex items-center gap-2 border-b border-line-soft pb-2 mb-4">
              <FaFileInvoiceDollar className="text-emerald-400" />
              Registration Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">GSTIN</span>
                <span className="text-sm font-bold text-ink tracking-wide">{company.gstin || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                <span className="text-xs font-semibold text-emerald-600/70 uppercase tracking-wider">Currency</span>
                <span className="text-sm font-bold text-emerald-700">{company.currencyCode || "INR"}</span>
              </div>
            </div>
          </section>

          {/* Address */}
          <section>
            <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-widest flex items-center gap-2 border-b border-line-soft pb-2 mb-4">
              <FaBuilding className="text-amber-400" />
              Address Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50 lg:col-span-2">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Address Line 1</span>
                <span className="text-sm font-bold text-ink">{company.addressLine1 || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50 lg:col-span-2">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Address Line 2</span>
                <span className="text-sm font-bold text-ink">{company.addressLine2 || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">City</span>
                <span className="text-sm font-bold text-ink">{company.city || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">State</span>
                <span className="text-sm font-bold text-ink">{company.state || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Zipcode</span>
                <span className="text-sm font-bold text-ink">{company.zipcode || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Country</span>
                <span className="text-sm font-bold text-ink">{company.country || "-"}</span>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-widest flex items-center gap-2 border-b border-line-soft pb-2 mb-4">
              <FaPhone className="text-blue-400" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Phone</span>
                <span className="text-sm font-bold text-ink">{company.phone || "-"}</span>
              </div>
              <div className="flex flex-col space-y-1 p-3 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Email</span>
                <span className="text-sm font-bold text-ink">{company.email || "-"}</span>
              </div>
            </div>
          </section>

          {/* System */}
          <section>
            <h3 className="text-sm font-bold text-ink-subtle uppercase tracking-widest flex items-center gap-2 border-b border-line-soft pb-2 mb-4">
              <FaServer className="text-purple-400" />
              System Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col space-y-3 p-4 bg-card rounded-xl border border-line-soft/50">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Logo Image</span>
                {company.logoUrl ? (
                  <div className="bg-card p-2 border border-line rounded-lg shadow-sm inline-block w-max">
                    <img
                      src={company.logoUrl}
                      alt="Company Logo"
                      className="max-w-37.5 max-h-20 object-contain"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-ink-subtle italic">No Logo Uploaded</span>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        {canEdit && (
          <div className="px-6 py-4 bg-card/80 border-t border-line-soft flex justify-end">
            <CustomButton
              text="Edit Company Profile"
              icon={FaEdit}
              onClick={() => navigate('/company/edit')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfile;
