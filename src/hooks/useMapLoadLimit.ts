import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MAX_MAP_LOADS, getCount, incrementCount } from '../utilities/mapLoadCounter';

const useMapLoadLimit = () => {
  const { appUser } = useAuth();
  const uid = appUser?.uid ?? '';

  const [count, setCount] = useState<number>(() => getCount(uid));

  const increment = useCallback(() => {
    if (!uid) return;
    const next = incrementCount(uid);
    setCount(next);
  }, [uid]);

  const atLimit = count >= MAX_MAP_LOADS;
  const remaining = Math.max(MAX_MAP_LOADS - count, 0);

  return { count, remaining, atLimit, increment, max: MAX_MAP_LOADS };
};

export default useMapLoadLimit;
