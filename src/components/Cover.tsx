import Image from "next/image";

export default function Cover({ src, size }: { src: string; size: "small" | "medium" | "large" }) {
  const [width, height] = { small: [36, 52], medium: [120, 170], large: [160, 228] }[size];
  if (!src) return <span className={`cover cover-${size}`} />;
  return <Image className={`cover cover-${size}`} src={src} alt="" width={width} height={height} />;
}
