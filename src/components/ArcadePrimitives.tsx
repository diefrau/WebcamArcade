import type React from "react";

export function Button({
  children,
  color = "pink",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button
      {...props}
      className={`arcade-button ${color} ${className}`}
      onClick={(e) => {
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
export function Sticker({
  children,
  color = "yellow",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <span className={`sticker ${color}`}>{children}</span>;
}
