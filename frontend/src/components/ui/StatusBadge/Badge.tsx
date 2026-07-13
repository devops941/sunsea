// src/components/ui/StatusBadge/StatusBadge.tsx
import React from 'react';

interface StatusBadgeProps {
    status: string;
    className?: string;
    customText?: string;
    customColor?: { bg: string; text: string };
    title?: string;
    style?: React.CSSProperties;
}

const statusColors: Record<string, { bg: string; text: string }> = {
    // ========== DRAFT & GENERAL ==========
    DRAFT: { bg: '#f3e8ff', text: '#6b21a8' },           // Gray - not yet submitted
    OPEN: { bg: '#e0f2fe', text: '#0369a1' },             // Sky Blue
    PARTIALLY_RECEIVED: { bg: '#ffedd5', text: '#c2410c' },       // Orange
    CLOSED: { bg: '#f3f4f6', text: '#374151' },                   // Dark Gray

    // ========== MD APPROVAL FLOW ==========
    PENDING_MD_APPROVAL: { bg: '#fef3c7', text: '#b45309' },  // Amber - awaiting MD review
    MD_APPROVED: { bg: '#d1fae5', text: '#065f46' },          // Green - MD approved
    MD_REJECTED: { bg: '#fee2e2', text: '#b91c1c' },          // Red - MD rejected

    // ========== CUSTOMER APPROVAL FLOW ==========
    PENDING_CUSTOMER_APPROVAL: { bg: '#fde68a', text: '#92400e' }, // Yellow - awaiting customer
    CUSTOMER_APPROVED: { bg: '#a7f3d0', text: '#064e3b' },         // Light Green - customer approved
    CUSTOMER_REJECTED: { bg: '#fecaca', text: '#991b1b' },         // Light Red - customer rejected

    // ========== CONFIRMED & QUOTATION ==========
    CONFIRMED: { bg: '#dbeafe', text: '#1d4ed8' },                 // Blue - order confirmed
    QUOTATION_IN_PROGRESS: { bg: '#e0e7ff', text: '#4338ca' },     // Indigo - preparing quote
    QUOTATION_COMPLETED: { bg: '#c7d2fe', text: '#3730a3' },       // Dark Indigo - quote done

    // ========== PRODUCTION FLOW ==========
    PLANNED: { bg: '#e8f0fe', text: '#1a73e8' },                   // Light Blue - production planned
    MATERIAL_PENDING: { bg: '#fef7e0', text: '#e37400' },          // Orange - waiting for materials
    MATERIAL_RESERVED: { bg: '#fde68a', text: '#b45309' },         // Amber - materials reserved
    MATERIAL_ISSUED: { bg: '#fcd34d', text: '#92400e' },           // Gold - materials issued
    SCHEDULED: { bg: '#d1fae5', text: '#065f46' },                 // Green - scheduled
    IN_PROGRESS: { bg: '#e8f0fe', text: '#1a73e8' },               // Blue - actively being made
    ON_HOLD: { bg: '#fce8e6', text: '#d93025' },                   // Red - paused
    IN_PRODUCTION: { bg: '#dbeafe', text: '#1d4ed8' },             // Blue - in production

    // ========== COMPLETION & DISPATCH ==========
    FG_RECEIVED: { bg: '#d1fae5', text: '#065f46' },               // Green - finished goods received
    READY_FOR_DISPATCH: { bg: '#a7f3d0', text: '#064e3b' },        // Light Green - ready to ship
    PARTIALLY_DISPATCHED: { bg: '#fde68a', text: '#92400e' },      // Amber - partially shipped
    DISPATCHED: { bg: '#d1fae5', text: '#065f46' },                // Green - fully shipped

    // ========== FINAL STATES ==========
    COMPLETED: { bg: '#d1fae5', text: '#065f46' },                 // Green - order complete
    CANCELLED: { bg: '#f3e8ff', text: '#6b21a8' },                 // Purple - cancelled

    // ========== LEGACY/COMMON STATUSES (for other modules) ==========
    ACTIVE: { bg: '#e6f4ea', text: '#1e8e3e' },
    INACTIVE: { bg: '#fce8e6', text: '#d93025' },
    PENDING: { bg: '#fef7e0', text: '#e37400' },
    APPROVED: { bg: '#e6f4ea', text: '#1e8e3e' },
    REJECTED: { bg: '#fce8e6', text: '#d93025' },
    AVAILABLE: { bg: '#e6f4ea', text: '#1e8e3e' },
    INSUFFICIENT: { bg: '#fce8e6', text: '#d93025' },

    // Production Orders

    RM_AVAILABLE: { bg: '#e6f4ea', text: '#1e8e3e' },
    RM_PENDING: { bg: '#fef7e0', text: '#e37400' },
    SCHEDULE_DELETED: { bg: '#fee2e2', text: '#b91c1c' }, // Light red background with dark red text


    // Priorities
    HIGH: { bg: '#fce8e6', text: '#d93025' },
    URGENT: { bg: '#fce8e6', text: '#d93025' },
    MEDIUM: { bg: '#fef7e0', text: '#e37400' },
    LOW: { bg: '#e6f4ea', text: '#1e8e3e' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', customText, customColor, title, style }) => {
    const normalizedStatus = (status || '').toUpperCase().replace(/\s+/g, '_');
    const colorScheme = customColor || statusColors[normalizedStatus] || { bg: '#f1f3f4', text: '#5f6368' };

    // Format display text: "PENDING_MD_APPROVAL" → "Pending MD Approval"
    const displayText = customText || (status || 'UNKNOWN')
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
        .map((word) => {
            // Keep common acronyms uppercase
            if (['md', 'rm', 'fg', 'wip', 'grn'].includes(word)) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');

    return (
        <span
            className={`status-pill ${className}`}
            title={title}
            style={{
                backgroundColor: colorScheme.bg,
                color: colorScheme.text,
                // 17% opacity
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                lineHeight: '1.5',
                ...style,
            }}
        >

            {displayText}
        </span>
    );
};

export default StatusBadge;