import { Link } from "react-router-dom";

import NotFoundImage from "../../../assets/images/home/page-not-found.webp";


const NotFoundPage = () => {
  return (
    <div className="not-found-page">

      <div className="not-found-card">

<div className="d-flex justify-content-center">

        <img
          src={NotFoundImage}
          alt="404"
          className="not-found-image"
        />
</div>

       

        <p className="not-found-message">
          Oops! The page you are looking
          for might have been removed,
          renamed, or is temporarily
          unavailable.
        </p>

        <Link
          to="/"
          className="not-found-btn"
        >
          Go Back To Dashboard
        </Link>

      </div>

    </div>
  );
};

export default NotFoundPage;