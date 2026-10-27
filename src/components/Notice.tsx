import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const TONE_ICON: Record<NoticeTone, IconName> = {
  info: 'info',
  warning: 'alert',
  danger: 'alert',
  success: 'check',
};

const TONE_ROLE: Record<NoticeTone, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  danger: 'alert',
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
}

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`} role={TONE_ROLE[tone]}>
      <Icon name={TONE_ICON[tone]} size={17} />
      <div className="notice__body">
        {title && <div className="notice__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
