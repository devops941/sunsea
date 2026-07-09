import React from 'react';
import { Card, Row } from 'react-bootstrap';

interface FilterCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const FilterCard: React.FC<FilterCardProps> = ({ 
  title = "Filter Specifications", 
  children, 
  className = "" 
}) => {
  return (
    <Card className={`border-0 shadow-sm rounded-3 p-4 mb-4 ${className}`}>
      {title && <h5 className="fw-bold mb-3 text-dark">{title}</h5>}
      <Row className="g-3">
        {children}
      </Row>
    </Card>
  );
};

export default FilterCard;
