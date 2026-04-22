import React from 'react';
import { AppUser } from '../types/auth';
import { UserIcon } from '../services/svgIcons';
import './UserAvatar.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface UserAvatarProps {
  user: AppUser | null;
  size?: AvatarSize;
  bordered?: boolean;
  borderColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const iconSizeMap: Record<AvatarSize, number> = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
};

const UserAvatar = ({ user, size = 'md', bordered = false, borderColor, className = '', style }: UserAvatarProps) => {
  const hasBorder = bordered || !!borderColor;
  const borderClass = hasBorder
    ? (borderColor ? ' user-avatar-border-custom' : ' user-avatar-bordered')
    : '';
  const sizeClass = `user-avatar user-avatar-${size}${borderClass}${className ? ' ' + className : ''}`;
  const mergedStyle: React.CSSProperties = borderColor
    ? { ...style, borderColor }
    : { ...style };

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.firstName || 'User'}
        className={sizeClass}
        style={mergedStyle}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${sizeClass} user-avatar-default`} style={mergedStyle}>
      <UserIcon size={iconSizeMap[size]} />
    </div>
  );
};

export default UserAvatar;
