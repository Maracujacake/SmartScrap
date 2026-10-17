import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Building2,
  Truck,
  Sprout,
  Mail,
  SlidersHorizontal,
} from 'lucide-react';

export const navigation = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'lots',
    label: 'Meus lotes',
    icon: Package,
  },
  {
    id: 'market',
    label: 'Postagens gerais',
    icon: LayoutDashboard,
  },
  {
    id: 'proposals',
    label: 'Propostas',
    icon: MessageSquare,
  },
  {
    id: 'companies',
    label: 'Empresas',
    icon: Building2,
  },
  {
    id: 'pickups',
    label: 'Coletas e entregas',
    icon: Truck,
  },
  {
    id: 'ngos',
    label: 'Órgãos e ONGs',
    icon: Sprout,
  },
];

export const extraNavigation = [
  { id: 'rates', label: 'Tarifas de frete', icon: SlidersHorizontal },
  { id: 'emails', label: 'E-mails', icon: Mail },
];

export function navigationFor(user) {
  const items =
    user.organization_type === 'carrier'
      ? navigation
          .filter((item) => ['dashboard', 'pickups'].includes(item.id))
          .map((item) => (item.id === 'pickups' ? { ...item, label: 'Meus transportes' } : item))
      : navigation;
  return [
    ...items,
    ...extraNavigation.filter(
      (item) => item.id === 'emails' || user.organization_type === 'carrier',
    ),
  ];
}
