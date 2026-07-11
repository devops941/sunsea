import React from 'react';
import { ProgressBar } from 'react-bootstrap';

interface CustomProgressBarProps {
  progressPercent: number;
}

const CustomProgressBar: React.FC<CustomProgressBarProps> = ({ progressPercent }) => {
  return (
    <div className="d-flex align-items-center gap-2">
      <ProgressBar 
        now={progressPercent} 
        variant={progressPercent === 100 ? "success" : progressPercent > 50 ? "info" : "warning"} 
        style={{ height: "10px", flex: 1, borderRadius: "5px" }} 
      />
      <span className="small fw-bold text-dark" style={{ minWidth: "35px" }}>{progressPercent}%</span>
    </div>
  );
};

export default CustomProgressBar;
