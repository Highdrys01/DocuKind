import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Droplets,
  FileText,
  FileWarning,
  Github,
  GripVertical,
  Image,
  Images,
  Layers,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Package,
  PenLine,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Droplets,
  FileText,
  FileWarning,
  Github,
  GripVertical,
  Image,
  Images,
  Layers,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Package,
  PenLine,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  UploadCloud,
  X
};

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, className, strokeWidth = 2 }: IconProps) {
  const Component = icons[name] ?? FileText;
  return <Component aria-hidden="true" className={className} size={size} strokeWidth={strokeWidth} />;
}
