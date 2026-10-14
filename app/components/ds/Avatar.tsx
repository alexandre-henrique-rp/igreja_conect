/**
 * <Avatar /> — círculo com iniciais ou imagem.
 *
 * **Tamanhos:** 32, 40, 48, 64, 96 (px).
 *
 * @example
 *   <Avatar name="João Silva" />
 *   <Avatar name="Maria" src="/avatars/maria.jpg" size={64} />
 */
import { cn } from "~/lib/cn";

export type AvatarSize = 32 | 40 | 48 | 64 | 96;

export type AvatarProps = {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
  alt?: string;
};

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string }> = {
  32: { box: "h-8 w-8", text: "text-xs" },
  40: { box: "h-10 w-10", text: "text-sm" },
  48: { box: "h-12 w-12", text: "text-base" },
  64: { box: "h-16 w-16", text: "text-lg" },
  96: { box: "h-24 w-24", text: "text-2xl" },
};

function iniciais(name: string): string {
  const partes = name.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
  alt,
}: AvatarProps) {
  const sizes = SIZE_CLASSES[size];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full overflow-hidden",
        "bg-accent-soft text-accent-strong font-extrabold shrink-0",
        sizes.box,
        sizes.text,
        className,
      )}
      aria-label={alt ?? name}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? name}
          className="h-full w-full object-cover"
        />
      ) : (
        iniciais(name)
      )}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 32,
  max = 4,
}: {
  users: Array<{ name: string; src?: string }>;
  size?: AvatarSize;
  max?: number;
}) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <span className="inline-flex">
      {visible.map((u, i) => (
        <span
          key={`${u.name}-${i}`}
          className={cn(i > 0 && "-ml-2")}
          style={{ zIndex: visible.length - i }}
        >
          <Avatar
            name={u.name}
            src={u.src}
            size={size}
            className="ring-2 ring-surface"
          />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "bg-surface-3 text-muted font-bold",
            "ring-2 ring-surface -ml-2",
            sizes_text(size),
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

function sizes_text(size: AvatarSize): string {
  return SIZE_CLASSES[size].text + " " + SIZE_CLASSES[size].box;
}
