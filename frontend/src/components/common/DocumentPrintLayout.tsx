import React from "react";
interface DocumentPrintLayoutProps {
    subtitle?: string;
    title?: string;
    children: React.ReactNode;
    id?: string;
}

export const DocumentPrintLayout: React.FC<DocumentPrintLayoutProps> = ({
    subtitle,
    title,
    children,
    id,
}) => {
    return (
        <div 
            id={id}
            className="font-sans text-black bg-white border-[1.5px] border-black w-full box-border"
        >
            <div className="text-center border-b-[1.5px] border-black py-[15px] px-[10px]">
                {subtitle && <div className="text-[12px] uppercase font-bold tracking-[2px] mb-[2px]">{subtitle}</div>}
                {title && <h1 className="text-[24px] font-extrabold m-0 tracking-[3px]">{title}</h1>}
            </div>
            {children}
        </div>
    );
};

export default DocumentPrintLayout;
