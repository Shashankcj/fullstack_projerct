import React from "react";
import GenesisLogo from "../../../assets/genesis_logo.png";

const GenesisLogoCard = ({
  copyright = `© ${new Date().getFullYear()} Genesis. All rights reserved`,
}) => {
  return (
    <div className="relative w-[105%] h-screen overflow-visible">
      {/* Main Gradient */}
      <div
        className="absolute inset-0 right-[-5%]"
        style={{
          background:
            "linear-gradient(160deg, #4338ca 0%, #2563eb 45%, #38bdf8 100%)",
        }}
      />

      {/* RIGHT WAVE - mirrored */}
<div className="absolute right-0 top-0 bottom-0 z-20 w-[95px]">
  <svg
    viewBox="0 0 95 1000"
    preserveAspectRatio="none"
    className="w-full h-full"
  >
    <path
      d="
        M95,0
        C17,-30 7,85 47,170
        C87,255 -3,355 37,470
        C77,585 0,690 35,805
        C67,905 10,965 33,1000
        L95,1000
        Z
      "
      fill="white"
    />
  </svg>
</div>

      {/* BOTTOM WAVES - Redesigned for smooth 'rolling' flow */}
      <div className="absolute bottom-[-10px] left-0 right-[-5%] h-[200px] z-10">
        {/* Back wave - Dark Indigo / Purple */}
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="none"
          className="absolute w-full h-full"
        >
          <path
            d="
              M0,130 
              C150,80 300,180 450,130 
              C600,80 700,130 700,130 
              L700,200 
              L0,200 
              Z
            "
            fill="#312e81" 
            fillOpacity="0.5"
          />
        </svg>

        {/* Front wave - Royal Blue / Purple */}
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="none"
          className="absolute w-full h-[160px] bottom-0"
        >
          <path
            d="
              M0,120 
              C250,180 500,40 700,120 
              L700,200 
              L0,200 
              Z
            "
            fill="#3730a3"
            fillOpacity="0.7"
          />
        </svg>
      </div>

      {/* Center Content */}
      <div
        className="
          relative z-30
          h-full
          flex flex-col
          items-center
          justify-center
          pb-10
          text-center
        "
      >
        {/* Logo */}
        <img
          src={GenesisLogo}
          alt="Genesis"
          className="w-20 h-20 object-contain mb-6"
        />

        {/* Title */}
        <h2 className="text-white font-bold text-2xl mb-4 tracking-wide">
  WELCOME TO GENESIS
</h2>

        {/* Subtitle */}
        <p className="text-white/90 text-lg leading-relaxed">
          Enter your email and password
          <br />
          to continue
        </p>
      </div>

      {/* Footer */}
      <p
        className="
          absolute
          bottom-8
          left-0
          right-0
          text-center
          text-white/70
          text-sm
          z-30
        "
      >
        {copyright}
      </p>

    </div>
  );
};

export default GenesisLogoCard;