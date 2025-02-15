import { useState } from 'react';

export const useLoadingState = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (asyncFunc) => {
    setIsLoading(true);
    setError(null);
    try {
      return await asyncFunc();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}; 