import React from "react";
import Image from "next/image";
import Link from "next/link";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Link href="/" className="cursor-pointer hover:opacity-80 transition-opacity">
      {isCollapsed ? (
        <div className="flex items-center justify-start mb-2">
          <Image src="/logo-collapsed.png" alt="Logo" width={40} height={32} />
        </div>
      ) : (
        <span className="text-lg text-center border rounded-full bg-blue-50 border-white font-semibold text-gray-700 mb-2 block items-center">
          <span>Pnyx</span>
        </span>
      )}
    </Link>
  );
});

Logo.displayName = "Logo";

export default Logo;