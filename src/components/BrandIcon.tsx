import { cn } from "@/lib/utils";
import {
  BRAND_ICON_ASSETS,
  type BrandIconName,
} from "./brandIcons";

type Props = {
  name: BrandIconName;
  size?: number;
  className?: string;
};

export function BrandIcon({ name, size = 12, className }: Props) {
  const iconSvg = BRAND_ICON_ASSETS[name];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:size-full",
        className,
      )}
      style={{
        width: size,
        height: size,
      }}
      dangerouslySetInnerHTML={{ __html: iconSvg }}
    />
  );
}
