import React from "react";

interface InfoProps {
    isCollapsed: boolean;
}

const Info = React.forwardRef<HTMLButtonElement, InfoProps>(({ isCollapsed }, ref) => {
  return null;
});

Info.displayName = "About";

export default Info; 