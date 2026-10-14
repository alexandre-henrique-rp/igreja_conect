/**
 * Igreja Conect — Design System (DS) — primitives barrel.
 *
 * **Regra de uso:** todo componente novo deve ser composto a partir destes
 * primitivos. Cores literais Tailwind (cyan-*, blue-6*, red-7*, etc.) são
 * proibidas; usar sempre os tokens semânticos expostos por `app.css`.
 *
 * Tokens disponíveis: `bg-accent`, `text-fg`, `text-muted`, `border-border`,
 * `bg-surface`, `bg-surface-2`, `text-danger`, `text-success`, `text-warning`,
 * `bg-accent-soft`, `bg-accent-soft-2`, etc.
 */
export { Button } from "./Button";
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
} from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";

export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "./Card";
export type { CardProps, CardVariant, CardPadding } from "./Card";

export { Field } from "./Field";
export type { FieldProps } from "./Field";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Textarea } from "./Textarea";
export type { TextareaProps } from "./Textarea";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone, BadgeSize } from "./Badge";

export { Chip } from "./Chip";
export type { ChipProps } from "./Chip";

export { Avatar, AvatarStack } from "./Avatar";
export type { AvatarProps, AvatarSize } from "./Avatar";

export { Icon, IconWrap, StatIcon } from "./Icon";
export type { IconProps, IconWrapProps, IconSize } from "./Icon";

export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps } from "./ProgressBar";

export { Stepper } from "./Stepper";
export type { StepperProps, StepperStep } from "./Stepper";

export { Tabs, TabList, TabPanel } from "./Tabs";
export type { TabsProps, TabListItem } from "./Tabs";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { Section } from "./Section";
export type { SectionProps } from "./Section";

export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSeparator,
} from "./Breadcrumb";

export { InfoBox } from "./InfoBox";
export type { InfoBoxProps, InfoBoxTone } from "./InfoBox";

export {
  FormSection,
  FormFooter,
  FormGrid,
  FormLayout,
  SpanTwo,
} from "./Form";

export {
  TableWrap,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "./Table";

export { KpiCard } from "./KpiCard";
export type { KpiCardProps } from "./KpiCard";

export { Modal, ModalBody, ModalFooter } from "./Modal";
export type { ModalProps } from "./Modal";

export { DateTile } from "./DateTile";
export type { DateTileProps } from "./DateTile";

export { Segmented } from "./Segmented";
export type { SegmentedProps, SegmentedOption } from "./Segmented";

export { RadioCard, RadioGroup } from "./RadioCard";
export type { RadioCardProps } from "./RadioCard";

export {
  AuthLayout,
  AuthVisual,
  AuthVisualCopy,
  AuthFormSide,
  AuthCard,
  LandingLayout,
  PublicNav,
  PublicFooter,
} from "./Layout";
