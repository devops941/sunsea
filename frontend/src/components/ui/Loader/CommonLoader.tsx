import React from "react";

interface CommonLoaderProps {
  text: string;
  image?: string; // Optional
  fullScreen?: boolean; // Optional, defaults to true
}

const CommonLoader: React.FC<CommonLoaderProps> = ({ text, image, fullScreen = true }) => {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${fullScreen ? "min-h-screen" : "min-h-[200px] w-full py-8"}`}>
      <div className={`relative flex flex-col items-center rounded-3xl border border-white/10 bg-white/5 text-center backdrop-blur-xl ${fullScreen ? "mb-20" : ""}`}>
        {image && (
          <div className="relative flex w-64 items-center justify-center">
            {/* Glow behind logo */}
            <div className="absolute h-24 w-48 animate-pulse rounded-full blur-xl" />

            <img
              src={image}
              alt="Loader"
              className="relative h-auto w-full object-contain"
            />
          </div>
        )}

        <p className="mt-4 bg-gradient-to-r from-gray-400 via-white to-gray-400 bg-[length:200%_100%] bg-clip-text text-base font-semibold tracking-wide text-transparent [animation:shimmer_2s_linear_infinite]">
          {text}
        </p>

        <div className="mt-3 flex gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-400" />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

export default CommonLoader;