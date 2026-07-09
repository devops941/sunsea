import React from "react";

const Footer: React.FC = () => {
  const nowYear = new Date().getFullYear();
  return (
    <footer className="app-footer">
      <p>
        © {nowYear} SUNSEA ERP. All Rights Reserved.
      </p>

      <p>
        Developed by{" "}
        <a
          href="https://kaizeninfinities.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kaizen Infinities
        </a>
      </p>
    </footer>
  );
};

export default Footer;