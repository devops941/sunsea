import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import CustomButton from '../Button/Button';

interface BackButtonProps {
  /** Optional path to navigate to. If not provided, it will go back in history. */
  to?: string;
  /** Text to display on the button. Defaults to "Back". */
  text?: string;
  /** Additional custom Tailwind classes */
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  to,
  text = "Back",
  className = ""
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1); // Go back one step in browser history
    }
  };

  return (
    <CustomButton
      variant='danger'
      text={text}
      icon={FaArrowLeft}
      onClick={handleBack}
      className={className}
    />
  );
};

export default BackButton;
