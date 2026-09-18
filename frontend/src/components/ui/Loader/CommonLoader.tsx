import React from "react";

interface CommonLoaderProps {
  text?: string;
  fullScreen?: boolean;
}

const CommonLoader: React.FC<CommonLoaderProps> = ({ text = "Loading...", fullScreen = true }) => {
  return (
    <div
      className={`relative flex items-center justify-center ${
        fullScreen ? "min-h-screen w-full" : "flex-1 min-h-[250px] w-full py-10"
      }`}
    >
      <div className={`flex flex-col items-center justify-center text-center p-4 ${fullScreen ? "mb-12" : ""}`}>
        <p className="text-sm sm:text-base font-semibold tracking-wide text-ink-muted animate-pulse">
          {text}
        </p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40" />
        </div>
      </div>
    </div>
  );
};

export default CommonLoader;
