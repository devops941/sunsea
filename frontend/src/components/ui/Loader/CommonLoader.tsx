import React from "react";

interface CommonLoaderProps {
  text: string;
  image?: string; // Optional
  fullScreen?: boolean; // Optional, defaults to true
}

const CommonLoader: React.FC<CommonLoaderProps> = ({ text, image, fullScreen = true }) => {
  return (
    <div className={`relative flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-[200px] w-full py-8"}`}>
      <div className={`flex flex-col items-center justify-center text-center p-4 ${fullScreen ? "mb-12" : ""}`}>
        {image && (
          <div className="relative flex w-48 sm:w-56 items-center justify-center mb-4">
            <img
              src={image}
              alt="Loader"
              className="relative h-auto w-full object-contain"
            />
          </div>
        )}

        <p className="text-sm sm:text-base font-semibold tracking-wide text-ink-muted animate-pulse">
          {text}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40" />
        </div>
      </div>
    </div>
  );
};

export default CommonLoader;