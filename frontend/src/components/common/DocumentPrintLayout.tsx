import React from "react";
import styles from "./DocumentPrintLayout.module.css";

interface DocumentPrintLayoutProps {
    subtitle: string;
    title: string;
    children: React.ReactNode;
}

export const DocumentPrintLayout: React.FC<DocumentPrintLayoutProps> = ({
    subtitle,
    title,
    children,
}) => {
    return (
        <div className={styles.printEstimateWrapper}>
            <div className={styles.printHeader}>
                <div className={styles.printHeaderSubTitle}>{subtitle}</div>
                <h1 className={styles.printHeaderMainTitle}>{title}</h1>
            </div>
            {children}
        </div>
    );
};

export default DocumentPrintLayout;
