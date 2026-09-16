import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }) {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      setKey(location.pathname);
      setVisible(true);
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 80);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div
      key={key}
      className={
        visible
          ? "animate-slide-up"
          : "opacity-0"
      }
    >
      {children}
    </div>
  );
}