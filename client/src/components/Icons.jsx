import {
  Squares2X2Icon,
  ViewColumnsIcon,
  UsersIcon,
  MapIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  BellIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  ClipboardIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  CameraIcon,
  PaperAirplaneIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChevronDownIcon,
  TrashIcon,
  QuestionMarkCircleIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  EyeSlashIcon,
  EyeIcon,
  ArrowLeftIcon,
  CubeIcon,
  ShoppingCartIcon,
  TruckIcon,
  MinusIcon,
  PlusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

export function IconGrid({ width = 18, height = 18, ...props }) {
  return <Squares2X2Icon width={width} height={height} {...props} />;
}

export function IconColumns({ width = 18, height = 18, ...props }) {
  return <ViewColumnsIcon width={width} height={height} {...props} />;
}

export function IconUsers({ width = 18, height = 18, ...props }) {
  return <UsersIcon width={width} height={height} {...props} />;
}

export function IconMap({ width = 18, height = 18, ...props }) {
  return <MapIcon width={width} height={height} {...props} />;
}

export function IconCheckSquare({ width = 18, height = 18, ...props }) {
  return <ClipboardDocumentCheckIcon width={width} height={height} {...props} />;
}

export function IconFileText({ width = 18, height = 18, ...props }) {
  return <DocumentTextIcon width={width} height={height} {...props} />;
}

export function IconSettings({ width = 18, height = 18, ...props }) {
  return <Cog6ToothIcon width={width} height={height} {...props} />;
}

export function IconSearch({ width = 16, height = 16, ...props }) {
  return <MagnifyingGlassIcon width={width} height={height} {...props} />;
}

export function IconBell({ width = 18, height = 18, ...props }) {
  return <BellIcon width={width} height={height} {...props} />;
}

export function IconX({ width = 18, height = 18, ...props }) {
  return <XMarkIcon width={width} height={height} {...props} />;
}

export function IconPhone({ width = 14, height = 14, ...props }) {
  return <PhoneIcon width={width} height={height} {...props} />;
}

export function IconMail({ width = 14, height = 14, ...props }) {
  return <EnvelopeIcon width={width} height={height} {...props} />;
}

export function IconCalendar({ width = 14, height = 14, ...props }) {
  return <CalendarDaysIcon width={width} height={height} {...props} />;
}

export function IconClipboard({ width = 14, height = 14, ...props }) {
  return <ClipboardIcon width={width} height={height} {...props} />;
}

export function IconDollar({ width = 14, height = 14, ...props }) {
  return <CurrencyDollarIcon width={width} height={height} {...props} />;
}

export function IconMapPin({ width = 24, height = 24, ...props }) {
  return <MapPinIcon width={width} height={height} {...props} />;
}

export function IconCamera({ width = 14, height = 14, ...props }) {
  return <CameraIcon width={width} height={height} {...props} />;
}

export function IconSend({ width = 14, height = 14, ...props }) {
  return <PaperAirplaneIcon width={width} height={height} {...props} />;
}

export function IconLogOut({ width = 18, height = 18, ...props }) {
  return <ArrowRightStartOnRectangleIcon width={width} height={height} {...props} />;
}

export function IconDownload({ width = 18, height = 18, ...props }) {
  return <ArrowDownTrayIcon width={width} height={height} {...props} />;
}

export function IconFilter({ width = 18, height = 18, ...props }) {
  return <FunnelIcon width={width} height={height} {...props} />;
}

export function IconChevronDown({ width = 18, height = 18, ...props }) {
  return <ChevronDownIcon width={width} height={height} {...props} />;
}

export function IconTrash({ width = 18, height = 18, ...props }) {
  return <TrashIcon width={width} height={height} {...props} />;
}

export function IconHelpCircle({ width = 18, height = 18, ...props }) {
  return <QuestionMarkCircleIcon width={width} height={height} {...props} />;
}

export function IconPlusCircle({ width = 18, height = 18, ...props }) {
  return <PlusCircleIcon width={width} height={height} {...props} />;
}

export function IconRefresh({ width = 18, height = 18, ...props }) {
  return <ArrowPathIcon width={width} height={height} {...props} />;
}

export function IconEyeOff({ width = 16, height = 16, ...props }) {
  return <EyeSlashIcon width={width} height={height} {...props} />;
}

export function IconEye({ width = 16, height = 16, ...props }) {
  return <EyeIcon width={width} height={height} {...props} />;
}

export function IconArrowLeft({ width = 18, height = 18, ...props }) {
  return <ArrowLeftIcon width={width} height={height} {...props} />;
}

export function IconPackage({ width = 18, height = 18, ...props }) {
  return <CubeIcon width={width} height={height} {...props} />;
}

export function IconShoppingCart({ width = 18, height = 18, ...props }) {
  return <ShoppingCartIcon width={width} height={height} {...props} />;
}

export function IconTruck({ width = 18, height = 18, ...props }) {
  return <TruckIcon width={width} height={height} {...props} />;
}

export function IconMinus({ width = 18, height = 18, ...props }) {
  return <MinusIcon width={width} height={height} {...props} />;
}

export function IconPlus({ width = 18, height = 18, ...props }) {
  return <PlusIcon width={width} height={height} {...props} />;
}

export function IconCheck({ width = 18, height = 18, ...props }) {
  return <CheckIcon width={width} height={height} {...props} />;
}

const iconMap = {
  grid: IconGrid,
  columns: IconColumns,
  users: IconUsers,
  map: IconMap,
  bell: IconBell,
  'check-square': IconCheckSquare,
  'file-text': IconFileText,
  settings: IconSettings,
};

export function NavIcon({ name, ...props }) {
  const Comp = iconMap[name];
  return Comp ? <Comp {...props} /> : null;
}
