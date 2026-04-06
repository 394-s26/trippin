import React from 'react';
import { AppUser } from '../types/auth';
import { UserIcon } from '../services/svgIcons';
import './UserAvatar.css';

type AvatarSize = 'sm' | 'md' | 'lg';

interface UserAvatarProps {
  user: AppUser | null;
  size?: AvatarSize;
  bordered?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const iconSizeMap: Record<AvatarSize, number> = {
  sm: 10,
  md: 14,
  lg: 18,
};

const UserAvatar = ({ user, size = 'md', bordered = false, className = '', style }: UserAvatarProps) => {
  const sizeClass = `user-avatar user-avatar-${size}${bordered ? ' user-avatar-bordered' : ''}${className ? ' ' + className : ''}`;

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.firstName || 'User'}
        className={sizeClass}
        style={style}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${sizeClass} user-avatar-default`} style={style}>
      <UserIcon size={iconSizeMap[size]} />
    </div>
  );
};

export default UserAvatar;
