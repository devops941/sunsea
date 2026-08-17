import React from "react";

const DetailBox: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div>
        <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wide flex items-center gap-1.5 mb-0.5">
            {icon && <span className="text-blue-500/70">{icon}</span>}
            {label}
        </div>
        <div className="text-sm text-ink">{value ?? "—"}</div>
    </div>
);

export default DetailBox;
