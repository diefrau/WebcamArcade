import { characterAssets, type CharacterAsset } from "../assets/characters";
import "./character.css";

type CharacterProps = {
  asset: CharacterAsset;
  size?: "icon" | "sm" | "md" | "lg" | "hero";
  className?: string;
  priority?: boolean;
} & ({ decorative?: true; alt?: never } | { decorative: false; alt: string });

export function Character({
  asset,
  size = "md",
  className = "",
  priority = false,
  decorative = true,
  alt,
}: CharacterProps) {
  const image = characterAssets[asset];
  return (
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      className={`character character--${size} character--${image.layout} ${className}`}
      data-character={asset}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
