import React from "react";

const Footer: React.FC = () => {
  const nowYear = new Date().getFullYear();
  return (
    <footer className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200 text-sm text-gray-500 shrink-0">
      <p>
        © {nowYear} SUNSEA ERP. All Rights Reserved.
      </p>

      <p>
        Developed by{" "}
        <a
          href="https://kaizeninfinities.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-semibold"
        >
          Kaizen Infinities
        </a>
      </p>
    </footer>
  );
};

export default Footer;