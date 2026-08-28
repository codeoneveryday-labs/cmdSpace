import { cn } from "@/lib/utils";
import {
  BRAND_ICON_ASSETS,
  BRAND_ICON_IMAGE_ASSETS,
  type BrandIconName,
} from "./brandIcons";

type Props = {
  name: BrandIconName;
  size?: number;
  className?: string;
};

export function BrandIcon({ name, size = 12, className }: Props) {
  const iconSvg = BRAND_ICON_ASSETS[
    name as keyof typeof BRAND_ICON_ASSETS
  ];
  const iconImage = BRAND_ICON_IMAGE_ASSETS[
    name as keyof typeof BRAND_ICON_IMAGE_ASSETS
  ];

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{
        width: size,
        height: size,
      }}
    >
      {iconImage ? (
        <img src={iconImage} alt="" className="size-full object-contain" />
      ) : (
        <span
          className="inline-flex size-full items-center justify-center [&>svg]:block [&>svg]:size-full!"
          dangerouslySetInnerHTML={{ __html: iconSvg ?? "" }}
        />
      )}
    </span>
  );
}
