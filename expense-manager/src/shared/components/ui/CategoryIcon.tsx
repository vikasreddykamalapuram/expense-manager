import {
  UtensilsCrossed, ShoppingCart, Car, ShoppingBag, Gamepad2, Zap,
  Heart, GraduationCap, Plane, Home, Shield, Sparkles, Gift, CreditCard,
  MoreHorizontal, Briefcase, Laptop, TrendingUp, Building2, Store,
  Rocket, RotateCcw, Percent, Smartphone, Banknote, Package, Coffee,
  Music, Film, Dumbbell, PawPrint, Baby, Wrench, Scissors, Palette,
  BookOpen, Stethoscope, Pill, Globe, Wifi, Phone, Tv, Camera,
  Headphones, Wallet, Gem, Crown, Trees, Flower2, Sun,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  UtensilsCrossed, ShoppingCart, Car, ShoppingBag, Gamepad2, Zap,
  Heart, GraduationCap, Plane, Home, Shield, Sparkles, Gift, CreditCard,
  MoreHorizontal, Briefcase, Laptop, TrendingUp, Building2, Store,
  Rocket, RotateCcw, Percent, Smartphone, Banknote, Package, Coffee,
  Music, Film, Dumbbell, PawPrint, Baby, Wrench, Scissors, Palette,
  BookOpen, Stethoscope, Pill, Globe, Wifi, Phone, Tv, Camera,
  Headphones, Wallet, Gem, Crown, Trees, Flower2, Sun,
};

interface CategoryIconProps {
  icon?: string;
  iconName?: string; // legacy alias
  color: string;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, iconName, color, size = 20, className = '' }: CategoryIconProps) {
  const Icon = iconMap[icon || iconName || ''] || MoreHorizontal;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg p-2 ${className}`}
      style={{ backgroundColor: `${color}15` }}
    >
      <Icon size={size} style={{ color }} />
    </div>
  );
}

interface CategoryBadgeProps {
  name: string;
  iconName: string;
  color: string;
}

export function CategoryBadge({ name, iconName, color }: CategoryBadgeProps) {
  const Icon = iconMap[iconName] || MoreHorizontal;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <Icon size={12} />
      {name}
    </span>
  );
}
